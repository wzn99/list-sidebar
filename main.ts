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

		// 注册文件变更监听器 - 实现双向同步
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.path === this.settings.filePath) {
					// 文件被外部修改，通知视图刷新
					if (this.listView) {
						this.listView.handleFileChanged();
					}
				}
			})
		);

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
			// Windows路径处理：先规范化，然后尝试所有可能的路径
			const normalizedPath = this.normalizePath(this.settings.filePath);
			let file = this.app.vault.getAbstractFileByPath(normalizedPath);

			// 如果规范化路径找不到文件，尝试使用原始路径
			if (!file || !(file instanceof TFile)) {
				file = this.app.vault.getAbstractFileByPath(this.settings.filePath);
				if (file && file instanceof TFile) {
					// 找到了文件，说明路径规范化可能有问题，更新设置中的路径
					this.settings.filePath = file.path;
					await this.saveSettings();
					console.log("loadLists: 使用原始路径找到文件", this.settings.filePath);
				}
			}

			// 如果是Windows路径（包含反斜杠），额外尝试转换路径
			if (!file && this.settings.filePath.includes('\\')) {
				const unixStylePath = this.settings.filePath.replace(/\\/g, '/');
				console.log("loadLists: 尝试Unix风格路径", unixStylePath);
				file = this.app.vault.getAbstractFileByPath(unixStylePath);
				if (file && file instanceof TFile) {
					this.settings.filePath = file.path;
					await this.saveSettings();
				}
			}

			// 最后尝试：检查是否有同名文件在不同路径
			if (!file) {
				console.warn("loadLists: 无法在指定路径找到文件", normalizedPath);
				console.warn("loadLists: 检查vault中是否有list-sidebar-data.md文件");

				// 尝试查找vault中的数据文件
				const allFiles = this.app.vault.getFiles();
				const dataFiles = allFiles.filter(f =>
					f.path.includes('list-sidebar-data') || f.path.endsWith('.md')
				);

				if (dataFiles.length > 0 && !normalizedPath.includes("/")) {
					// 如果设置在根目录，检查根目录下的文件
					const rootFile = dataFiles.find(f => !f.path.includes('/'));
					if (rootFile) {
						file = rootFile;
						this.settings.filePath = rootFile.path;
						await this.saveSettings();
						new Notice(`从 "${file.path}" 加载数据`);
					}
				}
			}

			if (!file || !(file instanceof TFile)) {
				console.log("loadLists: 文件不存在，返回空列表");
				return [];
			}

			console.log("loadLists: 成功找到文件", file.path);
			const content = await this.app.vault.read(file);
			const parsedLists = this.parseMarkdownFile(content);
			console.log("loadLists: 解析结果 - 列表数量:", parsedLists.length);
			return parsedLists;
		} catch (error) {
			console.error("加载列表数据失败:", error);
			console.error("尝试的路径:", this.settings.filePath);
			// 返回空数组而不是抛出错误，避免影响插件启动
			return [];
		}
	}

	async saveLists(lists: List[]): Promise<void> {
		try {
			// 关键安全检查1：防止用空数据覆盖已有内容的文件
			if (lists.length === 0 && this.settings.filePath === "list-sidebar-data.md") {
				let normalizedPath = this.normalizePath(this.settings.filePath);
				let existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);

				if (!existingFile && this.settings.filePath.includes('\\')) {
					const unixStylePath = this.settings.filePath.replace(/\\/g, '/');
					existingFile = this.app.vault.getAbstractFileByPath(unixStylePath);
				}

				if (existingFile && existingFile instanceof TFile) {
					const existingContent = await this.app.vault.read(existingFile);
					const existingLists = this.parseMarkdownFile(existingContent);

					// 如果文件有内容但试图保存空数据，拒绝保存
					if (existingLists.length > 0 && lists.length === 0) {
						console.error("保存被拒绝：试图用空数据覆盖已存在数据的文件");
						console.error("现有列表数量:", existingLists.length);
						new Notice("保存失败：文件包含数据，不能覆盖为空");
						return;
					}
				}
			}

			// 关键安全检查2：防止数据丢失（如果文件本身有多个列表，拒绝覆盖为空）
			if (lists.length === 0) {
				let normalizedPath = this.normalizePath(this.settings.filePath);
				let existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);

				if (!existingFile && this.settings.filePath.includes('\\')) {
					const unixStylePath = this.settings.filePath.replace(/\\/g, '/');
					existingFile = this.app.vault.getAbstractFileByPath(unixStylePath);
				}

				if (existingFile && existingFile instanceof TFile) {
					const existingContent = await this.app.vault.read(existingFile);
					const existingLists = this.parseMarkdownFile(existingContent);

					if (existingLists.length > 3) {
						console.error("保存被拒绝：文件有多个列表但试图保存为空");
						new Notice("保存失败：检测到数据丢失风险");
						return;
					}
				}
			}

			// 安全检查3：生成内容后如果异常短，可能是数据问题
			const content = this.generateMarkdownFile(lists);
			if (content.length < 30 && lists.length > 2) {
				console.error("保存被拒绝：生成的内容异常短但列表数量较多");
				console.error("列表数量:", lists.length, "内容长度:", content.length);
				new Notice("保存失败：内容生成异常");
				return;
			}

			// 规范化路径
			let normalizedPath = this.normalizePath(this.settings.filePath);
			let file = this.app.vault.getAbstractFileByPath(normalizedPath);

			// Windows路径兼容性：如果规范化路径找不到，尝试原始路径
			if (!file || !(file instanceof TFile)) {
				file = this.app.vault.getAbstractFileByPath(this.settings.filePath);
				if (file && file instanceof TFile) {
					this.settings.filePath = file.path;
					await this.saveSettings();
					console.log("saveLists: 使用原始路径找到文件", this.settings.filePath);
				}
			}

			// 如果是Windows路径（包含反斜杠），额外尝试转换路径
			if (!file && this.settings.filePath.includes('\\')) {
				const unixStylePath = this.settings.filePath.replace(/\\/g, '/');
				console.log("saveLists: 尝试Unix风格路径", unixStylePath);
				file = this.app.vault.getAbstractFileByPath(unixStylePath);
				if (file && file instanceof TFile) {
					this.settings.filePath = file.path;
					await this.saveSettings();
				}
			}

			// 保存文件
			if (file && file instanceof TFile) {
				await this.app.vault.modify(file, content);
				console.log("saveLists: 成功更新文件", file.path, "列表数量:", lists.length);
			} else {
				await this.app.vault.create(normalizedPath, content);
				console.log("saveLists: 成功创建新文件", normalizedPath);
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

	// 路径规范化方法（改为public以便在其他地方使用）
	normalizePath(path: string): string {
		if (!path) return path;

		// 保留原始路径以供Windows绝对路径检测
		const originalPath = path;

		// 将反斜杠转换为正斜杠
		path = path.replace(/\\/g, '/');

		// 处理Windows绝对路径（如 C:/Users/...）
		if (this.isWindowsAbsolutePath(originalPath)) {
			// 转换为相对于vault根目录的路径
			const relativePath = this.convertWindowsPathToRelative(originalPath);
			console.log("convertWindowsPathToRelative:", originalPath, "->", relativePath);
			return relativePath;
		}

		// 移除前导和尾随斜杠
		path = path.replace(/^\/+|\/+$/g, '');

		// 规范化多个连续斜杠为单个斜杠
		path = path.replace(/\/+/g, '/');

		return path;
	}

	private isWindowsAbsolutePath(path: string): boolean {
		// 检查是否为Windows绝对路径格式：如 C:\path\file.md 或 C:/path/file.md
		return /^[a-zA-Z]:[/\\]/.test(path);
	}

	private convertWindowsPathToRelative(windowsPath: string): string {
		let path = windowsPath.replace(/\\/g, '/');

		// 移除盘符，保留后续路径
		// C:/Users/.../vault/data.md -> Users/.../vault/data.md
		path = path.replace(/^[a-zA-Z]:[/\\]?/, '');

		// 尝试提取相对于vault的路径
		const vaultPath = (this.app.vault.adapter as any).basePath || '';
		if (vaultPath && path.includes(vaultPath)) {
			const index = path.indexOf(vaultPath);
			if (index >= 0) {
				path = path.substring(index + vaultPath.length);
				path = path.replace(/^[/\\]+/, '');
			}
		}

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

