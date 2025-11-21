# Obsidian List Sidebar Plugin

An Obsidian plugin that displays collapsible lists in the sidebar, supporting note links and plain text items for quick access to frequently used content.

## Features

- 📋 **Multiple Lists**: Create and manage multiple independent lists, each can be collapsed/expanded
- 🔗 **Note Links**: Support note links in `[[note]]` format - click to navigate
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

### From GitHub (Recommended)

1. Open Obsidian Settings
2. Go to "Community plugins" → "Browse"
3. Search for "List Sidebar" or:
   - Click "Install from GitHub"
   - Enter repository: `wzn99/obsidian_list_sidebar`
   - Click Install

### Manual Installation

1. Download the latest release files: `main.js`, `manifest.json`, and `styles.css`
2. Place them in your vault's `.obsidian/plugins/obsidian-list-sidebar/` directory
3. Reload Obsidian or restart the application

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
9. **Note Links**: Enter `[[note name]]` format to create clickable note links

## Settings

Configure in Obsidian Settings → Community plugins → List Sidebar:

- **Data File Path**: Set the Markdown file path to save list data (relative to vault root)
- **Show Dividers**: Toggle thin horizontal lines between items
- **Alternate Background**: Use subtle alternating background colors for items

## Data Format

List data is saved in Markdown format:

```markdown
## List Name <!-- expanded:true -->

- [[Note 1]]
- Plain text item
- [[Note 2]]
```

## Development

To contribute or modify the plugin:

```bash
# Install dependencies
npm install

# Development mode (auto-watch for changes)
npm run dev

# Build for production
npm run build
```

## License

MIT
