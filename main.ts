import { Plugin, PluginSettingTab, Setting, TFile, Notice, App } from "obsidian";
import { ListView, VIEW_TYPE_LIST_SIDEBAR } from "./src/ListView";
import { List, ListItem } from "./src/types";

interface ListSidebarSettings {
	filePath: string;
	showDividers: boolean;
	alternateBackground: boolean;
}

const DEFAULT_SETTINGS: ListSidebarSettings = {
	filePath: "list-sidebar-data.md",
	showDividers: true,
	alternateBackground: true
};

export default class ListSidebarPlugin extends Plugin {
	settings: ListSidebarSettings = DEFAULT_SETTINGS;
	private listView?: ListView;

	async onload() {
		await this.loadSettings();

		// 注册侧边栏视图
		this.registerView(
			VIEW_TYPE_LIST_SIDEBAR,
			(leaf) => {
				const view = new ListView(leaf, this);
				this.listView = view;
				return view;
			}
		);

		// 添加Ribbon图标
		this.addRibbonIcon("layers", "List Sidebar", () => {
			this.activateView();
		});

		// 添加命令
		this.addCommand({
			id: "open-list-sidebar",
			name: "Open List Sidebar",
			callback: () => {
				this.activateView();
			}
		});

		// 添加设置标签
		this.addSettingTab(new ListSidebarSettingTab(this.app, this));

		// 如果侧边栏已打开，激活视图
		this.app.workspace.onLayoutReady(() => {
			this.activateView();
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIST_SIDEBAR);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// 规范化路径，确保使用正斜杠
		if (this.settings.filePath) {
			this.settings.filePath = this.normalizePath(this.settings.filePath);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LIST_SIDEBAR)[0];

		if (!leaf) {
			const newLeaf = workspace.getLeftLeaf(false);
			if (newLeaf) {
				await newLeaf.setViewState({ type: VIEW_TYPE_LIST_SIDEBAR, active: true });
				leaf = newLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadLists(): Promise<List[]> {
		try {
			// 规范化路径
			const normalizedPath = this.normalizePath(this.settings.filePath);
			const file = this.app.vault.getAbstractFileByPath(normalizedPath);
			if (!file || !(file instanceof TFile)) {
				return [];
			}

			const content = await this.app.vault.read(file);
			return this.parseMarkdownFile(content);
		} catch (error) {
			console.error("加载列表数据失败:", error);
			return [];
		}
	}

	async saveLists(lists: List[]): Promise<void> {
		try {
			// 规范化路径
			const normalizedPath = this.normalizePath(this.settings.filePath);
			const file = this.app.vault.getAbstractFileByPath(normalizedPath);
			
			// 如果lists为空且文件已存在，先检查文件是否有内容
			// 避免用空内容覆盖已有数据的文件
			if (lists.length === 0 && file && file instanceof TFile) {
				try {
					const existingContent = await this.app.vault.read(file);
					// 如果文件有内容（去除空白后不为空），说明可能是加载失败
					// 不应该用空内容覆盖，应该先尝试重新加载
					if (existingContent.trim().length > 0) {
						const existingLists = this.parseMarkdownFile(existingContent);
						// 如果能够解析出内容，说明文件有数据，不应该覆盖
						if (existingLists.length > 0) {
							console.warn("保存列表数据：检测到文件有内容但lists为空，跳过保存以避免覆盖数据");
							return;
						}
					}
				} catch (readError) {
					// 读取失败，继续正常保存流程
					console.warn("读取现有文件内容失败，继续保存:", readError);
				}
			}
			
			const content = this.generateMarkdownFile(lists);
			
			if (file && file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				// 文件不存在，创建新文件
				await this.app.vault.create(normalizedPath, content);
			}
		} catch (error) {
			console.error("保存列表数据失败:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice("保存列表数据失败: " + errorMessage);
		}
	}

	private parseMarkdownFile(content: string): List[] {
		const lists: List[] = [];
		
		// 解析YAML frontmatter
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
		let metadata: any = {};
		
		if (frontmatterMatch) {
			try {
				// 简单的YAML解析（仅支持基本格式）
				const yamlContent = frontmatterMatch[1];
				const lines = yamlContent.split('\n');
				let currentList: any = null;
				
				lines.forEach(line => {
					const listMatch = line.match(/^(\w+):$/);
					if (listMatch) {
						if (currentList) {
							lists.push(currentList);
						}
						currentList = {
							name: listMatch[1],
							expanded: true,
							items: []
						};
					} else if (currentList && line.trim().startsWith('- ')) {
						const itemContent = line.trim().substring(2);
						currentList.items.push({ content: itemContent });
					} else if (line.trim().startsWith('expanded:')) {
						currentList.expanded = line.trim().substring(9).trim() === 'true';
					}
				});
				
				if (currentList) {
					lists.push(currentList);
				}
			} catch (e) {
				console.error("解析YAML失败:", e);
			}
		}

		// 如果没有frontmatter或解析失败，尝试解析正文
		if (lists.length === 0) {
			const bodyContent = frontmatterMatch ? content.substring(frontmatterMatch[0].length) : content;
			const lines = bodyContent.split('\n');
			let currentList: List | null = null;
			
			lines.forEach(line => {
				const listHeaderMatch = line.match(/^## (.+?)(\s*<!--.*?-->)?$/);
				if (listHeaderMatch) {
					if (currentList) {
						lists.push(currentList);
					}
					const listName = listHeaderMatch[1].trim();
					const expandedComment = listHeaderMatch[2] || "";
					const isExpanded = expandedComment.includes("expanded:true");
					currentList = {
						name: listName,
						expanded: isExpanded,
						items: []
					};
				} else if (currentList && line.trim().startsWith('- ')) {
					const itemContent = line.trim().substring(2);
					currentList.items.push({ content: itemContent });
				}
			});
			
			if (currentList) {
				lists.push(currentList);
			}
		}

		return lists.length > 0 ? lists : [];
	}

	private generateMarkdownFile(lists: List[]): string {
		// 使用Markdown格式，每个列表作为一个二级标题
		// 在注释中保存展开状态（因为Markdown格式简单）
		let content = "";
		
		lists.forEach((list, index) => {
			if (index > 0) {
				content += "\n";
			}
			// 在列表名称后添加注释保存展开状态
			const expandedMarker = list.expanded ? "<!-- expanded:true -->" : "<!-- expanded:false -->";
			content += `## ${list.name} ${expandedMarker}\n\n`;
			list.items.forEach(item => {
				content += `- ${item.content}\n`;
			});
		});

		return content;
	}

	openSettings() {
		(this.app as any).setting.open();
		(this.app as any).setting.openTabById(this.manifest.id);
	}

	// 添加路径规范化方法
	private normalizePath(path: string): string {
		// 将反斜杠转换为正斜杠
		path = path.replace(/\\/g, '/');
		// 移除前导和尾随斜杠（除非是根路径）
		path = path.replace(/^\/+|\/+$/g, '');
		// 规范化多个连续斜杠为单个斜杠
		path = path.replace(/\/+/g, '/');
		return path;
	}
}

class ListSidebarSettingTab extends PluginSettingTab {
	plugin: ListSidebarPlugin;

	constructor(app: App, plugin: ListSidebarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "List Sidebar Settings" });

		new Setting(containerEl)
			.setName("Data File Path")
			.setDesc("Markdown file path to save list data (relative to vault root)")
			.addText(text => text
				.setPlaceholder("e.g., list-sidebar-data.md")
				.setValue(this.plugin.settings.filePath)
				.onChange(async (value) => {
					// 规范化路径后再保存
					this.plugin.settings.filePath = this.plugin.normalizePath(value);
					await this.plugin.saveSettings();
					const listView = (this.plugin as any).listView;
					if (listView) {
						await listView.refresh();
					}
				}));

		new Setting(containerEl)
			.setName("Show Dividers")
			.setDesc("Show thin horizontal lines between items")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDividers)
				.onChange(async (value) => {
					this.plugin.settings.showDividers = value;
					await this.plugin.saveSettings();
					const listView = (this.plugin as any).listView;
					if (listView) {
						await listView.refresh();
					}
				}));

		new Setting(containerEl)
			.setName("Alternate Background")
			.setDesc("Use subtle alternating background colors for items")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.alternateBackground)
				.onChange(async (value) => {
					this.plugin.settings.alternateBackground = value;
					await this.plugin.saveSettings();
					const listView = (this.plugin as any).listView;
					if (listView) {
						await listView.refresh();
					}
				}));
	}
}

