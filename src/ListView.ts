import { ItemView, WorkspaceLeaf, Modal, App } from "obsidian";
import { List, ListItem, PluginData } from "./types";
import ListSidebarPlugin from "../main";

export const VIEW_TYPE_LIST_SIDEBAR = "list-sidebar-view";

export class ListView extends ItemView {
	plugin: ListSidebarPlugin;
	private lists: List[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: ListSidebarPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_LIST_SIDEBAR;
	}

	getDisplayText() {
		return "List Sidebar";
	}

	getIcon() {
		return "layers";
	}

	async onOpen() {
		await this.loadData();
		this.render();
	}

	async onClose() {
		// 清理工作
	}

	async loadData() {
		this.lists = await this.plugin.loadLists();
	}

	async saveData() {
		await this.plugin.saveLists(this.lists);
	}

	render() {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) {
			return;
		}
		container.empty();
		container.addClass("list-sidebar-container");

		// 添加设置按钮
		const headerEl = container.createDiv("list-sidebar-header");
		const settingsBtn = headerEl.createEl("button", {
			cls: "list-sidebar-settings-btn",
			attr: { "aria-label": "Settings" }
		});
		settingsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
		settingsBtn.onclick = () => {
			this.plugin.openSettings();
		};

		// 添加列表容器
		const listsContainer = container.createDiv("list-sidebar-lists");

		// 渲染所有列表
		this.lists.forEach((list, listIndex) => {
			this.renderList(listsContainer, list, listIndex);
		});

		// 添加新列表按钮
		const addListBtn = container.createEl("button", {
			cls: "list-sidebar-add-list-btn",
			attr: { "aria-label": "Add List" }
		});
		addListBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
		addListBtn.onclick = () => {
			this.showAddListInput(listsContainer);
		};
	}

	renderList(container: HTMLElement, list: List, listIndex: number) {
		const listEl = container.createDiv("list-sidebar-list");
		
		// 列表头部
		const headerEl = listEl.createDiv("list-sidebar-list-header");
		
		// 折叠/展开按钮
		const toggleBtn = headerEl.createEl("button", {
			cls: "list-sidebar-toggle-btn",
			attr: { "aria-label": list.expanded ? "Collapse" : "Expand" }
		});
		toggleBtn.innerHTML = list.expanded 
			? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
			: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
		toggleBtn.onclick = async () => {
			list.expanded = !list.expanded;
			await this.saveData();
			this.render();
		};

		// 列表名称（居中）
		const nameEl = headerEl.createEl("span", {
			text: list.name,
			cls: "list-sidebar-list-name"
		});

		// 删除列表按钮
		const deleteListBtn = headerEl.createEl("button", {
			cls: "list-sidebar-delete-btn",
			attr: { "aria-label": "Delete List" }
		});
		deleteListBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
		deleteListBtn.onclick = async () => {
			const confirmed = await this.showConfirmDialog(`Delete list "${list.name}"?`);
			if (confirmed) {
				this.lists.splice(listIndex, 1);
				await this.saveData();
				this.render();
			}
		};

		// 列表项容器
		if (list.expanded) {
			const itemsContainer = listEl.createDiv("list-sidebar-items");
			
			list.items.forEach((item, itemIndex) => {
				this.renderItem(itemsContainer, item, listIndex, itemIndex);
			});

			// 添加条目按钮
			const addItemBtn = itemsContainer.createEl("button", {
				cls: "list-sidebar-add-item-btn",
				attr: { "aria-label": "Add Item" }
			});
		addItemBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
			addItemBtn.onclick = () => {
				this.showAddItemInput(itemsContainer, listIndex);
			};
		}
	}

	renderItem(container: HTMLElement, item: ListItem, listIndex: number, itemIndex: number) {
		const itemEl = container.createDiv("list-sidebar-item");
		
		// 条目内容（纯文本，居中）
		const contentEl = itemEl.createDiv("list-sidebar-item-content");
		contentEl.createEl("span", {
			text: item.content
		});

		// 按钮容器（悬停时显示）
		const btnContainer = itemEl.createDiv("list-sidebar-item-buttons");
		
		// 编辑条目按钮
		const editItemBtn = btnContainer.createEl("button", {
			cls: "list-sidebar-edit-item-btn",
			attr: { "aria-label": "Edit Item" }
		});
		editItemBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
		editItemBtn.onclick = () => {
			this.showEditItemInput(itemEl, contentEl, listIndex, itemIndex, item.content);
		};

		// 删除条目按钮
		const deleteItemBtn = btnContainer.createEl("button", {
			cls: "list-sidebar-delete-item-btn",
			attr: { "aria-label": "Delete Item" }
		});
		deleteItemBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
		deleteItemBtn.onclick = async () => {
			this.lists[listIndex].items.splice(itemIndex, 1);
			await this.saveData();
			this.render();
		};
	}

	async refresh() {
		await this.loadData();
		this.render();
	}

	async showConfirmDialog(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, message, (confirmed) => {
				resolve(confirmed);
			});
			modal.open();
		});
	}

	showAddListInput(container: HTMLElement) {
		const inputEl = container.createEl("input", {
			type: "text",
			cls: "list-sidebar-inline-input"
		});
		inputEl.placeholder = "List name";
		
		const finishInput = async () => {
			const value = inputEl.value.trim();
			if (value) {
				const newList: List = {
					name: value,
					expanded: true,
					items: []
				};
				this.lists.push(newList);
				await this.saveData();
				this.render();
			} else {
				inputEl.remove();
			}
		};

		inputEl.focus();
		inputEl.onkeydown = async (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				inputEl.remove();
			}
		};
		
		inputEl.onblur = async () => {
			await finishInput();
		};
	}

	showAddItemInput(container: HTMLElement, listIndex: number) {
		const inputEl = container.createEl("input", {
			type: "text",
			cls: "list-sidebar-inline-input"
		});
		inputEl.placeholder = "Item content";
		
		const finishInput = async () => {
			const value = inputEl.value.trim();
			if (value) {
				const newItem: ListItem = {
					content: value
				};
				this.lists[listIndex].items.push(newItem);
				await this.saveData();
				this.render();
			} else {
				inputEl.remove();
			}
		};

		inputEl.focus();
		inputEl.onkeydown = async (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				inputEl.remove();
			}
		};
		
		inputEl.onblur = async () => {
			await finishInput();
		};
	}

	showEditItemInput(itemEl: HTMLElement, contentEl: HTMLElement, listIndex: number, itemIndex: number, currentValue: string) {
		contentEl.empty();
		const inputEl = contentEl.createEl("input", {
			type: "text",
			cls: "list-sidebar-inline-input"
		});
		inputEl.value = currentValue;
		
		const finishInput = async () => {
			const value = inputEl.value.trim();
			if (value && value !== currentValue) {
				this.lists[listIndex].items[itemIndex].content = value;
				await this.saveData();
				this.render();
			} else if (!value) {
				// 如果输入为空，删除条目
				this.lists[listIndex].items.splice(itemIndex, 1);
				await this.saveData();
				this.render();
			} else {
				// 没有变化，恢复显示
				this.render();
			}
		};

		inputEl.focus();
		inputEl.select();
		inputEl.onkeydown = async (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.render();
			}
		};
		
		inputEl.onblur = async () => {
			await finishInput();
		};
	}
}

class ConfirmModal extends Modal {
	private onSubmit: (confirmed: boolean) => void;

	constructor(app: App, private message: string, onSubmit: (confirmed: boolean) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv("modal-button-container");
		const confirmBtn = buttonContainer.createEl("button", {
			text: "OK",
			cls: "mod-cta"
		});
		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel"
		});

		confirmBtn.onclick = () => {
			this.onSubmit(true);
			this.close();
		};

		cancelBtn.onclick = () => {
			this.onSubmit(false);
			this.close();
		};

		confirmBtn.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

