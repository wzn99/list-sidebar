# Obsidian List Sidebar Plugin

An Obsidian plugin that displays collapsible lists in the sidebar for quick access to frequently used content.

## Features

- 📋 **Multiple Lists**: Create and manage multiple independent lists, each can be collapsed/expanded
- 📝 **Plain Text Items**: Add plain text entries to your lists
- ✏️ **Multi-line Editing**: Edit list names and items with multi-line textarea support
- 🖱️ **Drag & Drop**: 
  - Drag lists to reorder them
  - Drag items within a list to reorder
  - Drag items between different lists
- ➕ **Quick Actions**: Add, edit, and delete lists and items directly in the sidebar
- 💾 **Markdown Storage**: Data saved as Markdown format with customizable file path
- ⚙️ **Customizable Settings**: Configure data file path, dividers, and background colors

## Installation

### Using BART Plugin (Recommended)

1. Install the BART plugin if you haven't already
2. Open Obsidian Settings → Community plugins → BART
3. Enter the repository URL: `https://github.com/wzn99/obsidian_list_sidebar`
4. Click Install

### From Official Plugin Market

Coming soon...


## Usage

1. After installation, a list icon will appear in the left ribbon bar
2. Click the icon to open the List Sidebar
3. **Add a new list**: Click the "+" button at the bottom
4. **Add items**: Click the "+" button inside a list
5. **Edit list/item**: Double-click the list name or item content
6. **Toggle expand/collapse**: Click anywhere on the list header (not just the arrow)
7. **Delete**: Click the 🗑️ icon to delete lists or items
8. **Drag & Drop**: 
   - Drag list headers to reorder lists
   - Drag items to reorder within a list or move between lists

## Settings

Configure in Obsidian Settings → Community plugins → List Sidebar:

- **Data File Path**: Set the Markdown file path to save list data (relative to vault root)
- **Show Dividers**: Toggle thin horizontal lines between items
- **Alternate Background**: Use subtle alternating background colors for items

## Data Format

List data is saved in Markdown format:

```markdown
## List Name <!-- expanded:true -->

- Plain text item 1
- Plain text item 2
- Plain text item 3
```

