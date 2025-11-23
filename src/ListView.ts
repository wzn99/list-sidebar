import { ItemView, WorkspaceLeaf, Modal, App } from "obsidian";
import { List, ListItem, PluginData } from "./types";
import ListSidebarPlugin from "../main";

export const VIEW_TYPE_LIST_SIDEBAR = "list-sidebar-view";

export class ListView extends ItemView {
	plugin: ListSidebarPlugin;
	private lists: List[] = [];
	private mainContainer: HTMLElement | null = null;

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
		// 保存container引用，供item拖移使用
		this.mainContainer = container;

		// 添加列表容器
		const listsContainer = container.createDiv("list-sidebar-lists");
		
		// 处理列表容器的拖拽事件
		listsContainer.ondragover = (e) => {
			const draggingItem = container.querySelector(".list-sidebar-item.dragging");
			const draggingList = container.querySelector(".list-sidebar-list.dragging");
			if (draggingItem) {
				e.preventDefault();
				// 不允许在列表容器上放置条目
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "none";
				}
			} else if (draggingList) {
				// 允许在列表容器上拖动list
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "move";
				}
			}
		};
		
		listsContainer.ondrop = async (e) => {
			const draggingItem = container.querySelector(".list-sidebar-item.dragging");
			const draggingList = container.querySelector(".list-sidebar-list.dragging") as HTMLElement;
			if (draggingItem) {
				e.preventDefault();
				// 拖到非法区域，回弹
				this.render();
			} else if (draggingList) {
				// 处理list拖到空白区域的情况
				e.preventDefault();
				if (e.dataTransfer) {
					const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
					if (!isNaN(fromIndex)) {
						// 计算最终位置（最后一个位置）
						const toIndex = Array.from(listsContainer.children).filter(
							el => el.classList.contains("list-sidebar-list")
						).indexOf(draggingList);
						if (toIndex >= 0 && toIndex < this.lists.length && fromIndex !== toIndex) {
							draggingList.dataset.dragProcessed = "true";
							const [movedList] = this.lists.splice(fromIndex, 1);
							this.lists.splice(toIndex, 0, movedList);
							await this.saveData();
							// 不在这里调用 render，让 ondragend 处理
						}
					}
				}
			}
		};
		
		// 处理整个容器的拖拽离开事件，防止条目拖到容器外
		container.ondragover = (e) => {
			const dragging = container.querySelector(".list-sidebar-item.dragging");
			if (dragging) {
				// 检查是否在有效的列表项容器内
				const target = e.target as HTMLElement;
				const itemsContainer = target.closest(".list-sidebar-items");
				if (!itemsContainer) {
					e.preventDefault();
					if (e.dataTransfer) {
						e.dataTransfer.dropEffect = "none";
					}
				} else {
					// 允许跨list移动，只要在有效的list容器内即可
					e.preventDefault();
					if (e.dataTransfer) {
						e.dataTransfer.dropEffect = "move";
					}
				}
			}
		};
		
		container.ondrop = (e) => {
			const dragging = container.querySelector(".list-sidebar-item.dragging");
			if (dragging) {
				// 检查是否在有效的列表项容器内
				const target = e.target as HTMLElement;
				const itemsContainer = target.closest(".list-sidebar-items");
				if (!itemsContainer) {
					e.preventDefault();
					// 拖到非法区域，回弹
					this.render();
				}
				// 如果在有效的list容器内，允许放置（由itemEl.ondrop处理）
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
		let isValidDrop = false;
		listEl.ondragstart = (e) => {
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", listIndex.toString());
			}
			listEl.classList.add("dragging");
			listEl.dataset.dragProcessed = "false";
			dragStartIndex = listIndex;
			isValidDrop = false;
		};
		
		listEl.ondragend = async (e) => {
			const wasProcessed = listEl.dataset.dragProcessed === "true";
			listEl.classList.remove("dragging");
			delete listEl.dataset.dragProcessed;
			// 如果已经有有效放置，只需要重新渲染以同步UI
			if (wasProcessed || isValidDrop) {
				this.render();
				return;
			}
			// 检查最终位置是否改变
			const finalIndex = Array.from(container.children).filter(
				el => el.classList.contains("list-sidebar-list")
			).indexOf(listEl);
			// 如果位置没变，需要回弹动画
			if (finalIndex === dragStartIndex) {
				this.render();
			} else if (finalIndex !== dragStartIndex) {
				// 如果位置改变了但没有有效放置（比如拖到了过远的地方），直接调整到有效位置
				const validIndex = Math.min(Math.max(0, finalIndex), this.lists.length - 1);
				if (validIndex >= 0 && validIndex !== dragStartIndex && validIndex < this.lists.length) {
					const [movedList] = this.lists.splice(dragStartIndex, 1);
					this.lists.splice(validIndex, 0, movedList);
					await this.saveData();
					this.render();
				} else {
					// 无效位置，回弹
					this.render();
				}
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
				const toIndex = Array.from(container.children).filter(
					el => el.classList.contains("list-sidebar-list")
				).indexOf(listEl);
				if (fromIndex !== toIndex && !isNaN(fromIndex) && toIndex >= 0 && toIndex < this.lists.length) {
					isValidDrop = true;
					listEl.dataset.dragProcessed = "true";
					const [movedList] = this.lists.splice(fromIndex, 1);
					this.lists.splice(toIndex, 0, movedList);
					await this.saveData();
					// 位置改变了，直接更新，不需要回弹动画
					// 注意：不在这里调用 render，让 ondragend 处理，避免重复渲染
				}
			}
		};
		
		// 列表头部
		const headerEl = listEl.createDiv("list-sidebar-list-header");
		
		// 整个header可以点击来切换展开/收缩
		headerEl.style.cursor = "pointer";
		let clickTimer: NodeJS.Timeout | null = null;
		let isDoubleClick = false;
		headerEl.onclick = async (e) => {
			// 如果点击的是删除按钮，不切换
			if ((e.target as HTMLElement).closest(".list-sidebar-delete-btn")) {
				return;
			}
			// 如果点击的是名称区域，延迟处理，等待可能的双击
			if ((e.target as HTMLElement).closest(".list-sidebar-list-name")) {
				if (clickTimer) {
					clearTimeout(clickTimer);
					clickTimer = null;
				}
				clickTimer = setTimeout(async () => {
					if (!isDoubleClick) {
						list.expanded = !list.expanded;
						await this.saveData();
						this.render();
					}
					isDoubleClick = false;
					clickTimer = null;
				}, 300); // 300ms延迟，等待双击事件
				return;
			}
			// 其他区域直接切换
			list.expanded = !list.expanded;
			await this.saveData();
			this.render();
		};
		
		// 折叠/展开图标（仅显示，不处理点击）
		const toggleBtn = headerEl.createDiv("list-sidebar-toggle-btn");
		toggleBtn.innerHTML = list.expanded 
			? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
			: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';

		// 列表名称（居中，可双击编辑）
		const nameEl = headerEl.createEl("span", {
			text: list.name,
			cls: "list-sidebar-list-name"
		});
		nameEl.style.cursor = "pointer";
		nameEl.ondblclick = (e) => {
			e.stopPropagation();
			isDoubleClick = true;
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = null;
			}
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
			
			// 为itemsContainer添加拖移支持，允许拖移到空白区域
			itemsContainer.ondragover = (e) => {
				// 验证itemsContainer是否在有效的list内
				const listEl = itemsContainer.closest(".list-sidebar-list");
				if (!listEl) {
					return;
				}
				
				const dragging = this.mainContainer?.querySelector(".list-sidebar-item.dragging") as HTMLElement;
				if (!dragging) return;
				if (!dragging.classList.contains("list-sidebar-item")) return;
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "move";
				}
				// 找到最后一个item元素，将dragging插入到末尾（在addItemBtn之前）
				const items = Array.from(itemsContainer.children).filter(
					el => el.classList.contains("list-sidebar-item")
				);
				// 找到addItemBtn（如果存在）
				const addBtn = itemsContainer.querySelector(".list-sidebar-add-item-btn");
				if (addBtn) {
					// 如果有addItemBtn，插入到它之前
					itemsContainer.insertBefore(dragging, addBtn);
				} else {
					// 如果没有addItemBtn，直接append
					itemsContainer.appendChild(dragging);
				}
			};
			
			itemsContainer.ondrop = async (e) => {
				// 验证itemsContainer是否在有效的list内
				const listEl = itemsContainer.closest(".list-sidebar-list") as HTMLElement;
				if (!listEl) {
					e.preventDefault();
					this.render();
					return;
				}
				const targetListIndex = parseInt(listEl.dataset.listIndex || "-1");
				if (targetListIndex < 0 || targetListIndex >= this.lists.length) {
					e.preventDefault();
					this.render();
					return;
				}
				
				const dragging = this.mainContainer?.querySelector(".list-sidebar-item.dragging") as HTMLElement;
				if (!dragging) return;
				if (!dragging.classList.contains("list-sidebar-item")) return;
				e.preventDefault();
				if (e.dataTransfer) {
					try {
						const data = JSON.parse(e.dataTransfer.getData("text/plain"));
						const fromListIndex = data.listIndex;
						const fromItemIndex = data.itemIndex;
						// 计算目标位置（最后一个位置）
						const items = Array.from(itemsContainer.children).filter(
							el => el.classList.contains("list-sidebar-item")
						);
						const toItemIndex = items.indexOf(dragging);
						
						if (!isNaN(fromListIndex) && !isNaN(fromItemIndex) && 
						    !isNaN(toItemIndex) && toItemIndex >= 0 && 
						    fromListIndex >= 0 && fromListIndex < this.lists.length &&
						    fromItemIndex >= 0 && fromItemIndex < this.lists[fromListIndex].items.length &&
						    toItemIndex <= this.lists[targetListIndex].items.length) {
							if (fromListIndex === targetListIndex && fromItemIndex !== toItemIndex) {
								// 同一list内移动
								dragging.dataset.dragProcessed = "true";
								const [movedItem] = this.lists[targetListIndex].items.splice(fromItemIndex, 1);
								this.lists[targetListIndex].items.splice(toItemIndex, 0, movedItem);
								await this.saveData();
							} else if (fromListIndex !== targetListIndex) {
								// 跨list移动
								dragging.dataset.dragProcessed = "true";
								const [movedItem] = this.lists[fromListIndex].items.splice(fromItemIndex, 1);
								this.lists[targetListIndex].items.splice(toItemIndex, 0, movedItem);
								await this.saveData();
							}
						}
					} catch (error) {
						// 解析错误，回弹
						this.render();
					}
				}
			};
			
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
		
		// 拖拽处理 - 参考list的拖移逻辑
		let dragStartItemIndex = itemIndex;
		let dragStartListIndex = listIndex;
		let isValidItemDrop = false;
		itemEl.ondragstart = (e) => {
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", JSON.stringify({ listIndex, itemIndex }));
				// 创建一个空的拖拽图像，避免显示原始内容
				const dragImage = document.createElement("div");
				dragImage.style.position = "absolute";
				dragImage.style.top = "-1000px";
				dragImage.style.width = "1px";
				dragImage.style.height = "1px";
				dragImage.style.opacity = "0";
				document.body.appendChild(dragImage);
				e.dataTransfer.setDragImage(dragImage, 0, 0);
				// 延迟移除，确保拖拽图像已设置
				setTimeout(() => {
					document.body.removeChild(dragImage);
				}, 0);
			}
			itemEl.classList.add("dragging");
			itemEl.dataset.dragProcessed = "false";
			dragStartItemIndex = itemIndex;
			dragStartListIndex = listIndex;
			isValidItemDrop = false;
		};
		
		itemEl.ondragend = async (e) => {
			const wasProcessed = itemEl.dataset.dragProcessed === "true";
			itemEl.classList.remove("dragging");
			delete itemEl.dataset.dragProcessed;
			// 如果已经有有效放置，只需要重新渲染以同步UI
			if (wasProcessed || isValidItemDrop) {
				this.render();
				return;
			}
			// 检查条目是否还在有效的容器内（任何list都可以）
			const itemsContainer = itemEl.closest(".list-sidebar-items") as HTMLElement;
			if (!itemsContainer) {
				// 条目不在任何list容器内，回弹
				this.render();
				return;
			}
			// 验证itemsContainer是否在有效的list内
			const finalListEl = itemsContainer.closest(".list-sidebar-list") as HTMLElement;
			if (!finalListEl) {
				// 不在有效的list内，回弹
				this.render();
				return;
			}
			const finalListIndex = parseInt(finalListEl.dataset.listIndex || "-1");
			if (finalListIndex < 0 || finalListIndex >= this.lists.length) {
				// 无效的list索引，回弹
				this.render();
				return;
			}
			
			const finalIndex = Array.from(itemsContainer.children).filter(
				el => el.classList.contains("list-sidebar-item")
			).indexOf(itemEl);
			
			// 如果位置没变，需要回弹动画
			if (finalListIndex === dragStartListIndex && finalIndex === dragStartItemIndex) {
				this.render();
			} else if (finalIndex >= 0 && finalIndex <= this.lists[finalListIndex].items.length) {
				// 位置改变了，即使之前经过非法位置，只要最终位置合法，就允许放置
				if (finalListIndex === dragStartListIndex) {
					// 同一list内移动
					const [movedItem] = this.lists[dragStartListIndex].items.splice(dragStartItemIndex, 1);
					this.lists[dragStartListIndex].items.splice(finalIndex, 0, movedItem);
				} else {
					// 跨list移动
					const [movedItem] = this.lists[dragStartListIndex].items.splice(dragStartItemIndex, 1);
					this.lists[finalListIndex].items.splice(finalIndex, 0, movedItem);
				}
				await this.saveData();
				this.render();
			} else {
				// 无效位置，回弹
				this.render();
			}
		};
		
		itemEl.ondragover = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move";
			}
			const afterElement = this.getDragAfterElement(container, e.clientY, "item");
			// 先在当前container中查找，如果找不到（跨list拖移），在整个主容器中查找
			let dragging = container.querySelector(".list-sidebar-item.dragging") as HTMLElement;
			if (!dragging && this.mainContainer) {
				dragging = this.mainContainer.querySelector(".list-sidebar-item.dragging") as HTMLElement;
			}
			if (dragging) {
				if (afterElement == null) {
					container.appendChild(dragging);
				} else {
					container.insertBefore(dragging, afterElement);
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
					
					// 验证目标listIndex（从container的父list获取）
					const targetListEl = container.closest(".list-sidebar-list") as HTMLElement;
					const targetListIndex = targetListEl ? parseInt(targetListEl.dataset.listIndex || "-1") : -1;
					
					// 支持跨list移动，只要位置有效
					if (!isNaN(fromListIndex) && !isNaN(fromItemIndex) && 
					    !isNaN(toItemIndex) && toItemIndex >= 0 && 
					    fromListIndex >= 0 && fromListIndex < this.lists.length &&
					    fromItemIndex >= 0 && fromItemIndex < this.lists[fromListIndex].items.length &&
					    targetListIndex >= 0 && targetListIndex < this.lists.length &&
					    toItemIndex <= this.lists[targetListIndex].items.length) {
						// 如果是在同一list内移动
						if (fromListIndex === targetListIndex && fromItemIndex !== toItemIndex) {
							isValidItemDrop = true;
							itemEl.dataset.dragProcessed = "true";
							const [movedItem] = this.lists[targetListIndex].items.splice(fromItemIndex, 1);
							this.lists[targetListIndex].items.splice(toItemIndex, 0, movedItem);
							await this.saveData();
							// 不在这里调用 render，让 ondragend 处理
						} else if (fromListIndex !== targetListIndex) {
							// 跨list移动
							isValidItemDrop = true;
							itemEl.dataset.dragProcessed = "true";
							const [movedItem] = this.lists[fromListIndex].items.splice(fromItemIndex, 1);
							this.lists[targetListIndex].items.splice(toItemIndex, 0, movedItem);
							await this.saveData();
							// 不在这里调用 render，让 ondragend 处理
						}
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
		const textareaEl = container.createEl("textarea", {
			cls: "list-sidebar-inline-input"
		});
		textareaEl.placeholder = "List name";
		textareaEl.rows = 1;
		// 自动调整高度
		const adjustHeight = () => {
			textareaEl.style.height = "auto";
			textareaEl.style.height = textareaEl.scrollHeight + "px";
		};
		textareaEl.addEventListener("input", adjustHeight);
		
		let isFinished = false;
		const finishInput = async () => {
			if (isFinished) return;
			isFinished = true;
			const value = textareaEl.value.trim();
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
				textareaEl.remove();
			}
		};

		textareaEl.focus();
		// 处理中文输入法组合输入
		let isComposing = false;
		textareaEl.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		textareaEl.addEventListener("compositionend", () => {
			isComposing = false;
		});
		textareaEl.onkeydown = async (e) => {
			if (e.key === "Enter" && !e.shiftKey && !isComposing) {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				textareaEl.remove();
			}
		};
		
		textareaEl.onblur = async () => {
			await finishInput();
		};
	}

	showAddItemInput(container: HTMLElement, listIndex: number) {
		// 隐藏添加按钮
		const addBtn = container.querySelector(".list-sidebar-add-item-btn") as HTMLElement;
		if (addBtn) {
			addBtn.style.display = "none";
			addBtn.style.visibility = "hidden";
		}
		
		const textareaEl = container.createEl("textarea", {
			cls: "list-sidebar-inline-input"
		});
		textareaEl.placeholder = "Item content";
		textareaEl.rows = 1;
		// 自动调整高度
		const adjustHeight = () => {
			textareaEl.style.height = "auto";
			textareaEl.style.height = textareaEl.scrollHeight + "px";
		};
		textareaEl.addEventListener("input", adjustHeight);
		
		let isFinished = false;
		const finishInput = async () => {
			if (isFinished) return;
			isFinished = true;
			const value = textareaEl.value.trim();
			if (value) {
				const newItem: ListItem = {
					content: value
				};
				this.lists[listIndex].items.push(newItem);
				await this.saveData();
				this.render();
			} else {
				textareaEl.remove();
				// 恢复添加按钮的显示（通过悬停）
				if (addBtn) {
					addBtn.style.display = "";
					addBtn.style.visibility = "";
				}
			}
		};

		textareaEl.focus();
		// 处理中文输入法组合输入
		let isComposing = false;
		textareaEl.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		textareaEl.addEventListener("compositionend", () => {
			isComposing = false;
		});
		textareaEl.onkeydown = async (e) => {
			if (e.key === "Enter" && !e.shiftKey && !isComposing) {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				textareaEl.remove();
				// 恢复添加按钮的显示（通过悬停）
				if (addBtn) {
					addBtn.style.display = "";
					addBtn.style.visibility = "";
				}
			}
		};
		
		textareaEl.onblur = async () => {
			await finishInput();
		};
	}

	showEditListNameInput(nameEl: HTMLElement, listIndex: number, currentValue: string) {
		const originalText = nameEl.textContent;
		nameEl.empty();
		const textareaEl = nameEl.createEl("textarea", {
			cls: "list-sidebar-inline-input"
		});
		textareaEl.value = currentValue;
		textareaEl.rows = 1;
		// 自动调整高度
		const adjustHeight = () => {
			textareaEl.style.height = "auto";
			textareaEl.style.height = textareaEl.scrollHeight + "px";
		};
		adjustHeight();
		textareaEl.addEventListener("input", adjustHeight);
		
		let isFinished = false;
		const finishInput = async () => {
			if (isFinished) return;
			isFinished = true;
			const value = textareaEl.value.trim();
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

		textareaEl.focus();
		textareaEl.select();
		// 处理中文输入法组合输入
		let isComposing = false;
		textareaEl.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		textareaEl.addEventListener("compositionend", () => {
			isComposing = false;
		});
		textareaEl.onkeydown = async (e) => {
			if (e.key === "Enter" && !e.shiftKey && !isComposing) {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.render();
			}
		};
		
		textareaEl.onblur = async () => {
			await finishInput();
		};
	}

	showEditItemInput(itemEl: HTMLElement, contentEl: HTMLElement, listIndex: number, itemIndex: number, currentValue: string) {
		contentEl.empty();
		const textareaEl = contentEl.createEl("textarea", {
			cls: "list-sidebar-inline-input"
		});
		textareaEl.value = currentValue;
		textareaEl.rows = 1;
		// 自动调整高度
		const adjustHeight = () => {
			textareaEl.style.height = "auto";
			textareaEl.style.height = textareaEl.scrollHeight + "px";
		};
		adjustHeight();
		textareaEl.addEventListener("input", adjustHeight);
		
		let isFinished = false;
		const finishInput = async () => {
			if (isFinished) return;
			isFinished = true;
			const value = textareaEl.value.trim();
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

		textareaEl.focus();
		textareaEl.select();
		// 处理中文输入法组合输入
		let isComposing = false;
		textareaEl.addEventListener("compositionstart", () => {
			isComposing = true;
		});
		textareaEl.addEventListener("compositionend", () => {
			isComposing = false;
		});
		textareaEl.onkeydown = async (e) => {
			if (e.key === "Enter" && !e.shiftKey && !isComposing) {
				e.preventDefault();
				await finishInput();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.render();
			}
		};
		
		textareaEl.onblur = async () => {
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

