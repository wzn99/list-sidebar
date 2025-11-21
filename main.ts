import { Plugin, PluginSettingTab, Setting, TFile, Notice, App } from "obsidian";
import { ListView, VIEW_TYPE_LIST_SIDEBAR } from "./src/ListView";
import { List, ListItem } from "./src/types";

interface ListSidebarSettings {
	filePath: string;
}

const DEFAULT_SETTINGS: ListSidebarSettings = {
	filePath: "list-sidebar-data.md"
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LIST_SIDEBAR)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
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
			const file = this.app.vault.getAbstractFileByPath(this.settings.filePath);
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
			const content = this.generateMarkdownFile(lists);
			const file = this.app.vault.getAbstractFileByPath(this.settings.filePath);
			
			if (file && file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				// 文件不存在，创建新文件
				await this.app.vault.create(this.settings.filePath, content);
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
					this.plugin.settings.filePath = value;
					await this.plugin.saveSettings();
					const listView = (this.plugin as any).listView;
					if (listView) {
						await listView.refresh();
					}
				}));
	}
}

