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
		
		// 处理列表容器的拖拽离开事件，防止条目拖到列表外
		listsContainer.ondragover = (e) => {
			const dragging = container.querySelector(".list-sidebar-item.dragging");
			if (dragging) {
				e.preventDefault();
				// 不允许在列表容器上放置条目
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "none";
				}
			}
		};
		
		listsContainer.ondrop = (e) => {
			const dragging = container.querySelector(".list-sidebar-item.dragging");
			if (dragging) {
				e.preventDefault();
				// 拖到非法区域，回弹
				this.render();
			}
		};

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
		listEl.draggable = true;
		listEl.dataset.listIndex = listIndex.toString();
		
		// 拖拽处理
		let dragStartIndex = listIndex;
		listEl.ondragstart = (e) => {
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", listIndex.toString());
			}
			listEl.classList.add("dragging");
			dragStartIndex = listIndex;
		};
		
		listEl.ondragend = async (e) => {
			listEl.classList.remove("dragging");
			// 检查最终位置是否改变
			const finalIndex = Array.from(container.children).indexOf(listEl);
			// 如果位置没变，需要回弹动画
			if (finalIndex === dragStartIndex) {
				this.render();
			}
		};
		
		listEl.ondragover = (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move";
			}
			const afterElement = this.getDragAfterElement(container, e.clientY, "list");
			const dragging = container.querySelector(".dragging");
			if (dragging) {
				if (afterElement == null) {
					container.appendChild(dragging as HTMLElement);
				} else {
					container.insertBefore(dragging as HTMLElement, afterElement);
				}
			}
		};
		
		listEl.ondrop = async (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
				const toIndex = Array.from(container.children).indexOf(listEl);
				if (fromIndex !== toIndex && !isNaN(fromIndex)) {
					const [movedList] = this.lists.splice(fromIndex, 1);
					this.lists.splice(toIndex, 0, movedList);
					await this.saveData();
					// 位置改变了，直接更新，不需要回弹动画
					this.render();
				}
			}
		};
		
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

		// 列表名称（居中，可双击编辑）
		const nameEl = headerEl.createEl("span", {
			text: list.name,
			cls: "list-sidebar-list-name"
		});
		nameEl.style.cursor = "pointer";
		nameEl.ondblclick = (e) => {
			e.stopPropagation();
			this.showEditListNameInput(nameEl, listIndex, list.name);
		};

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
			
			// 应用分隔线样式
			if (this.plugin.settings.showDividers) {
				itemsContainer.classList.add("show-dividers");
			}
			
			list.items.forEach((item, itemIndex) => {
				this.renderItem(itemsContainer, item, listIndex, itemIndex, list.items.length);
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

	renderItem(container: HTMLElement, item: ListItem, listIndex: number, itemIndex: number, totalItems: number) {
		const itemEl = container.createDiv("list-sidebar-item");
		itemEl.style.cursor = "pointer";
		itemEl.draggable = true;
		itemEl.dataset.itemIndex = itemIndex.toString();
		itemEl.dataset.listIndex = listIndex.toString();
		
		// 应用背景色交替
		if (this.plugin.settings.alternateBackground && itemIndex % 2 === 1) {
			itemEl.classList.add("list-sidebar-item-alternate");
		}
		
		// 拖拽处理
		let dragStartItemIndex = itemIndex;
		itemEl.ondragstart = (e) => {
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", JSON.stringify({ listIndex, itemIndex }));
			}
			itemEl.classList.add("dragging");
			dragStartItemIndex = itemIndex;
		};
		
		itemEl.ondragend = async (e) => {
			itemEl.classList.remove("dragging");
			// 检查最终位置是否改变
			const finalIndex = Array.from(container.children).filter(
				el => el.classList.contains("list-sidebar-item")
			).indexOf(itemEl);
			// 如果位置没变，需要回弹动画
			if (finalIndex === dragStartItemIndex) {
				this.render();
			}
			// 如果拖到非法区域，回弹到原位置
			if (e.dataTransfer && e.dataTransfer.dropEffect === "none") {
				this.render();
			}
		};
		
		itemEl.ondragover = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move";
			}
			// 检查是否在同一列表内
			const dragging = container.querySelector(".dragging") as HTMLElement;
			if (!dragging) return;
			
			const dragData = dragging.dataset;
			const dragListIndex = parseInt(dragData.listIndex || "-1");
			
			// 只允许在同一列表内拖动
			if (dragListIndex === listIndex) {
				const afterElement = this.getDragAfterElement(container, e.clientY, "item");
				// 实时移动其他条目（类似list的做法）
				if (afterElement == null) {
					container.appendChild(dragging);
				} else {
					container.insertBefore(dragging, afterElement);
				}
			} else {
				// 不在同一列表，不允许放置
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "none";
				}
			}
		};
		
		itemEl.ondrop = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			if (e.dataTransfer) {
				try {
					const data = JSON.parse(e.dataTransfer.getData("text/plain"));
					const fromListIndex = data.listIndex;
					const fromItemIndex = data.itemIndex;
					const toItemIndex = Array.from(container.children).filter(
						el => el.classList.contains("list-sidebar-item")
					).indexOf(itemEl);
					
					// 确保在同一列表内且位置不同
					if (fromListIndex === listIndex && fromItemIndex !== toItemIndex && 
					    !isNaN(fromItemIndex) && !isNaN(toItemIndex) && toItemIndex >= 0) {
						const [movedItem] = this.lists[listIndex].items.splice(fromItemIndex, 1);
						this.lists[listIndex].items.splice(toItemIndex, 0, movedItem);
						await this.saveData();
						// 位置改变了，直接更新，不需要回弹动画
						this.render();
					}
				} catch (error) {
					// 解析错误，回弹
					this.render();
				}
			}
		};
		
		// 条目内容（纯文本，居中，可双击编辑）
		const contentEl = itemEl.createDiv("list-sidebar-item-content");
		contentEl.createEl("span", {
			text: item.content
		});
		
		// 双击整行即可编辑
		itemEl.ondblclick = (e) => {
			e.stopPropagation();
			this.showEditItemInput(itemEl, contentEl, listIndex, itemIndex, item.content);
		};

		// 按钮容器（悬停时显示）
		const btnContainer = itemEl.createDiv("list-sidebar-item-buttons");
		
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

	getDragAfterElement(container: HTMLElement, y: number, type: string): HTMLElement | null {
		const draggableElements = Array.from(container.children).filter((el: Element) => {
			return el.classList.contains(type === "list" ? "list-sidebar-list" : "list-sidebar-item") && 
			       !el.classList.contains("dragging");
		}) as HTMLElement[];

		return draggableElements.reduce((closest, child) => {
			const box = child.getBoundingClientRect();
			const offset = y - box.top - box.height / 2;

			if (offset < 0 && offset > closest.offset) {
				return { offset, element: child };
			} else {
				return closest;
			}
		}, { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }).element;
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

	showEditListNameInput(nameEl: HTMLElement, listIndex: number, currentValue: string) {
		const originalText = nameEl.textContent;
		nameEl.empty();
		const inputEl = nameEl.createEl("input", {
			type: "text",
			cls: "list-sidebar-inline-input"
		});
		inputEl.value = currentValue;
		
		const finishInput = async () => {
			const value = inputEl.value.trim();
			if (value && value !== currentValue) {
				this.lists[listIndex].name = value;
				await this.saveData();
				this.render();
			} else if (!value) {
				// 如果输入为空，恢复原值
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

