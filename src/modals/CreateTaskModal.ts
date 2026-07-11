import { App, Modal, Notice, Setting } from "obsidian";
import { AsanaAPI } from "../api";
import { AsanaPluginSettings, AsanaWorkspace } from "../types";

export class CreateTaskModal extends Modal {
  name = "";
  notes = "";
  dueOn = "";
  projectGid = "";
  workspaceGid = "";
  assignee = "";
  workspaces: AsanaWorkspace[] = [];

  constructor(
    app: App,
    private settings: AsanaPluginSettings,
    private onCreated?: (url: string, name: string) => void
  ) {
    super(app);
    this.workspaceGid = settings.defaultWorkspaceGid;
    this.projectGid = settings.defaultProjectGid;
    this.assignee = settings.defaultAssignee;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Create Asana Task" });

    this.loadWorkspacesAndProjects();

    new Setting(contentEl)
      .setName("Task name")
      .setClass("asana-modal-required")
      .addText((text) => text.setPlaceholder("Task name").setValue(this.name).onChange((v) => (this.name = v)));

    new Setting(contentEl)
      .setName("Description")
      .addTextArea((ta) =>
        ta.setPlaceholder("Optional description…").setValue(this.notes).onChange((v) => (this.notes = v))
      );

    new Setting(contentEl)
      .setName("Due date")
      .addText((text) =>
        text.setPlaceholder("YYYY-MM-DD").setValue(this.dueOn).onChange((v) => (this.dueOn = v))
      );

    new Setting(contentEl)
      .setName("Assignee")
      .setDesc('Use "me" for yourself, or paste a user GID.')
      .addText((text) =>
        text.setPlaceholder("me").setValue(this.assignee).onChange((v) => (this.assignee = v))
      );

    new Setting(contentEl)
      .setName("Workspace GID")
      .setDesc("Leave blank to use the default workspace.")
      .addText((text) =>
        text
          .setPlaceholder(this.settings.defaultWorkspaceGid)
          .setValue(this.workspaceGid)
          .onChange((v) => {
            this.workspaceGid = v;
          })
      );

    new Setting(contentEl)
      .setName("Project GID")
      .setDesc("Optional. Leave blank for a workspace-level task.")
      .addText((text) =>
        text
          .setPlaceholder(this.settings.defaultProjectGid)
          .setValue(this.projectGid)
          .onChange((v) => (this.projectGid = v))
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Create Task")
        .setCta()
        .onClick(async () => {
          if (!this.name.trim()) {
            new Notice("Task name is required.");
            return;
          }
          btn.setButtonText("Creating…").setDisabled(true);
          try {
            const api = new AsanaAPI(this.settings.pat);
            const wsGid = this.workspaceGid || this.settings.defaultWorkspaceGid;
            const projGid = this.projectGid || this.settings.defaultProjectGid;
            const task = await api.createTask({
              name: this.name.trim(),
              notes: this.notes.trim() || undefined,
              due_on: this.dueOn.trim() || undefined,
              workspace: wsGid || undefined,
              projects: projGid ? [projGid] : undefined,
              assignee: this.assignee.trim() || "me",
            });
            new Notice(`Created: ${task.name}`);
            if (this.onCreated) {
              this.onCreated(task.permalink_url, task.name);
            }
            this.close();
          } catch (e) {
            new Notice("Failed to create task: " + e.message);
            btn.setButtonText("Create Task").setDisabled(false);
          }
        })
    );
  }

  async loadWorkspacesAndProjects() {
    try {
      const api = new AsanaAPI(this.settings.pat);
      this.workspaces = await api.getWorkspaces();
    } catch (e) {
      // silently ignore — GID fields still work without this
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
