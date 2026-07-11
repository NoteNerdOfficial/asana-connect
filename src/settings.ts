import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AsanaPlugin from "./main";
import { AsanaAPI } from "./api";

export class AsanaSettingTab extends PluginSettingTab {
  plugin: AsanaPlugin;

  constructor(app: App, plugin: AsanaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Asana Plugin Settings" });

    new Setting(containerEl)
      .setName("Personal Access Token")
      .setDesc("Create one at Account Settings → Apps → Personal Access Tokens in Asana.")
      .addText((text) =>
        text
          .setPlaceholder("0/xxxxxxxxxxxxxxxxxxxxxxxxxxxx")
          .setValue(this.plugin.settings.pat)
          .onChange(async (value) => {
            this.plugin.settings.pat = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Verify connection")
      .setDesc("Test your PAT and load available workspaces.")
      .addButton((btn) =>
        btn
          .setButtonText("Connect")
          .setCta()
          .onClick(async () => {
            btn.setButtonText("Connecting…").setDisabled(true);
            try {
              const api = new AsanaAPI(this.plugin.settings.pat);
              const me = await api.getMe();
              new Notice(`Connected as ${me.name}`);
              this.plugin.settings.defaultWorkspaceGid =
                this.plugin.settings.defaultWorkspaceGid || me.workspaces[0]?.gid || "";
              this.plugin.settings.defaultWorkspaceName =
                this.plugin.settings.defaultWorkspaceName || me.workspaces[0]?.name || "";
              await this.plugin.saveSettings();
              this.display();
            } catch (e) {
              new Notice(`Connection failed: ${e.message}`);
            } finally {
              btn.setButtonText("Connect").setDisabled(false);
            }
          })
      );

    containerEl.createEl("h3", { text: "Defaults" });

    new Setting(containerEl)
      .setName("Default workspace GID")
      .setDesc("Workspace GID to use when none is specified in a code block. Find it in your Asana URL.")
      .addText((text) =>
        text
          .setPlaceholder("123456789")
          .setValue(this.plugin.settings.defaultWorkspaceGid)
          .onChange(async (value) => {
            this.plugin.settings.defaultWorkspaceGid = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default workspace name")
      .setDesc("Display name for the default workspace.")
      .addText((text) =>
        text
          .setPlaceholder("My Organisation")
          .setValue(this.plugin.settings.defaultWorkspaceName)
          .onChange(async (value) => {
            this.plugin.settings.defaultWorkspaceName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default project GID")
      .setDesc("Pre-selected project GID when creating tasks. Leave blank for workspace-level tasks.")
      .addText((text) =>
        text
          .setPlaceholder("987654321")
          .setValue(this.plugin.settings.defaultProjectGid)
          .onChange(async (value) => {
            this.plugin.settings.defaultProjectGid = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default assignee")
      .setDesc('Use "me" to assign to yourself, or paste a user GID.')
      .addText((text) =>
        text
          .setPlaceholder("me")
          .setValue(this.plugin.settings.defaultAssignee)
          .onChange(async (value) => {
            this.plugin.settings.defaultAssignee = value.trim();
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Display" });

    new Setting(containerEl)
      .setName("Show completed tasks in lists")
      .setDesc("When enabled, task list views will include completed tasks.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCompletedTasks).onChange(async (value) => {
          this.plugin.settings.showCompletedTasks = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Task list refresh interval (seconds)")
      .setDesc("How often the task list sidebar auto-refreshes. Set to 0 to disable.")
      .addText((text) =>
        text
          .setPlaceholder("300")
          .setValue(String(this.plugin.settings.taskListRefreshInterval))
          .onChange(async (value) => {
            const n = parseInt(value);
            if (!isNaN(n)) {
              this.plugin.settings.taskListRefreshInterval = n;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
