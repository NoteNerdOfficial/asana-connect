import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { AsanaAPI } from "./api";
import { AsanaSettingTab } from "./settings";
import { AsanaPluginSettings, DEFAULT_SETTINGS } from "./types";
import { TaskEmbedRenderer } from "./renderers/TaskEmbedRenderer";
import { TaskListRenderer } from "./renderers/TaskListRenderer";
import { CreateTaskModal } from "./modals/CreateTaskModal";
import { TaskSearchModal } from "./modals/TaskSearchModal";
import { ASANA_TASK_VIEW_TYPE, AsanaTaskView } from "./views/TaskListView";

export default class AsanaPlugin extends Plugin {
  settings: AsanaPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(ASANA_TASK_VIEW_TYPE, (leaf) => {
      return new AsanaTaskView(leaf, () => this.settings);
    });

    this.registerMarkdownCodeBlockProcessor("asana-task", (source, el, ctx) => {
      const renderer = new TaskEmbedRenderer(el, source, this.settings);
      ctx.addChild(renderer);
    });

    this.registerMarkdownCodeBlockProcessor("asana-tasks", (source, el, ctx) => {
      const renderer = new TaskListRenderer(el, source, this.settings);
      ctx.addChild(renderer);
    });

    this.addCommand({
      id: "open-task-sidebar",
      name: "Open My Tasks sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addCommand({
      id: "create-task",
      name: "Create Asana task",
      callback: () => {
        new CreateTaskModal(this.app, this.settings).open();
      },
    });

    this.addCommand({
      id: "create-task-from-selection",
      name: "Create Asana task from selection and insert link",
      editorCallback: (editor) => {
        const selection = editor.getSelection().trim();
        const modal = new CreateTaskModal(this.app, this.settings, (url, name) => {
          const link = `[${name}](${url})`;
          if (selection) {
            editor.replaceSelection(link);
          } else {
            editor.replaceRange(link, editor.getCursor());
          }
        });
        if (selection) {
          modal.name = selection;
        }
        modal.open();
      },
    });

    this.addCommand({
      id: "search-and-insert-task",
      name: "Search Asana tasks and insert link",
      editorCallback: (editor) => {
        new TaskSearchModal(this.app, this.settings, (task) => {
          const link = `[${task.name}](${task.permalink_url})`;
          editor.replaceRange(link, editor.getCursor());
        }).open();
      },
    });

    this.addCommand({
      id: "search-and-embed-task",
      name: "Search Asana tasks and embed block",
      editorCallback: (editor) => {
        new TaskSearchModal(this.app, this.settings, (task) => {
          const block = `\`\`\`asana-task\n${task.gid}\n\`\`\`\n`;
          editor.replaceRange(block, editor.getCursor());
        }).open();
      },
    });

    this.addCommand({
      id: "link-note-to-task",
      name: "Link this note to an Asana task",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (checking) return true;
        new TaskSearchModal(this.app, this.settings, async (task) => {
          const file = view.file;
          if (!file) return;
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm["asana-task-gid"] = task.gid;
            fm["asana-task-url"] = task.permalink_url;
            fm["asana-task-name"] = task.name;
          });
          new Notice(`Note linked to: ${task.name}`);
        }).open();
        return true;
      },
    });

    this.addCommand({
      id: "sync-linked-task",
      name: "Sync linked Asana task status",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (checking) return true;
        this.syncLinkedTask(view.file);
        return true;
      },
    });

    this.addCommand({
      id: "complete-linked-task",
      name: "Complete linked Asana task",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (checking) return true;
        this.toggleLinkedTaskComplete(view.file, true);
        return true;
      },
    });

    this.addRibbonIcon("check-square", "Asana Tasks", () => {
      this.activateSidebar();
    });

    this.addSettingTab(new AsanaSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.pat && this.settings.defaultWorkspaceGid) {
        this.activateSidebar();
      }
    });
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(ASANA_TASK_VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateSidebar() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(ASANA_TASK_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: ASANA_TASK_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async syncLinkedTask(file: TFile) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const gid = fm?.["asana-task-gid"];
    if (!gid) {
      new Notice("No Asana task linked to this note. Use 'Link this note to an Asana task' first.");
      return;
    }
    try {
      const api = new AsanaAPI(this.settings.pat);
      const task = await api.getTask(gid);
      await this.app.fileManager.processFrontMatter(file, (f) => {
        f["asana-task-completed"] = task.completed;
        f["asana-task-name"] = task.name;
        f["asana-due-on"] = task.due_on ?? "";
        f["asana-assignee"] = task.assignee?.name ?? "";
      });
      new Notice(`Synced: ${task.name} (${task.completed ? "completed" : "open"})`);
    } catch (e) {
      new Notice("Sync failed: " + e.message);
    }
  }

  async toggleLinkedTaskComplete(file: TFile, complete: boolean) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const gid = fm?.["asana-task-gid"];
    if (!gid) {
      new Notice("No Asana task linked to this note.");
      return;
    }
    try {
      const api = new AsanaAPI(this.settings.pat);
      const task = complete ? await api.completeTask(gid) : await api.uncompleteTask(gid);
      await this.app.fileManager.processFrontMatter(file, (f) => {
        f["asana-task-completed"] = task.completed;
      });
      new Notice(`Task marked ${task.completed ? "open" : "complete"}: ${task.name}`);
    } catch (e) {
      new Notice("Failed: " + e.message);
    }
  }
}
