/**
 * The native application menu.
 *
 * Every item forwards a COMMAND ID to the renderer rather than doing work here.
 * That way the menu, the command palette and the keyboard all drive the same
 * registry, and a plugin's command is reachable from all three without the menu
 * knowing anything about plugins.
 *
 * Accelerators are deliberately NOT set for app commands: keybindings are
 * config-driven in the renderer, and a native accelerator would silently
 * outrank whatever the user put in settings.json.
 */
import { Menu, app, type MenuItemConstructorOptions } from 'electron'

export function buildMenu(send: (commandId: string) => void): void {
  const item = (label: string, commandId: string): MenuItemConstructorOptions => ({
    label,
    click: () => send(commandId),
  })

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        item('New Workspace…', 'workspace.create'),
        item('Open Workspace…', 'workspace.open'),
        item('Switch Workspace…', 'workspace.switch'),
        { type: 'separator' },
        item('Configure Workspace…', 'workspace.configure'),
        { type: 'separator' },
        item('Quick Open…', 'palette.quickOpen'),
        item('Close Tab', 'tab.close'),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'selectAll' },
        { type: 'separator' },
        item('Find in Workspace', 'search.openGlobal'),
      ],
    },
    {
      label: 'View',
      submenu: [
        item('Command Palette…', 'palette.commands'),
        { type: 'separator' },
        item('Toggle Explorer', 'view.toggleExplorer'),
        item('Toggle Context Panel', 'view.toggleContextPanel'),
        item('Toggle Outline', 'view.toggleOutline'),
        { type: 'separator' },
        item('Split Editor Right', 'view.splitRight'),
        item('Close Split', 'view.closeSplit'),
        { type: 'separator' },
        item('Toggle Light/Dark Theme', 'view.toggleTheme'),
        item('Zoom In', 'view.zoomIn'),
        item('Zoom Out', 'view.zoomOut'),
        item('Reset Zoom', 'view.zoomReset'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Replacing the default menu removes Electron's built-in reload
        // accelerators too. In development that costs you the fastest way to
        // clear renderer-side caches, so put them back.
        ...(app.isPackaged
          ? []
          : ([
              { type: 'separator' },
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
            ] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'Go',
      submenu: [
        item('Back', 'nav.back'),
        item('Forward', 'nav.forward'),
        { type: 'separator' },
        item('Home Screen', 'workspace.goHome'),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
