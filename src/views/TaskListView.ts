import { ItemView, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import { AsanaAPI } from "../api";
import { AsanaPluginSettings, AsanaTask } from "../types";

export const ASANA_TASK_VIEW_TYPE = "asana-task-view";

export class AsanaTaskView extends ItemView {
  private tasks: AsanaTask[] = [];
  private refreshTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, private getSettings: () => AsanaPluginSettings) {
    super(leaf);
  }

  getViewType() {
    return ASANA_TASK_VIEW_TYPE;
  }

  getDisplayText() {
    return "Asana Tasks";
  }

  getIcon() {
    return "check-square";
  }

  async onOpen() {
    await this.refresh();
    this.startAutoRefresh();
  }

  onClose() {
    this.stopAutoRefresh();
    return Promise.resolve();
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = this.getSettings().taskListRefreshInterval;
    if (interval > 0) {
      this.refreshTimer = window.setInterval(() => this.refresh(), interval * 1000);
    }
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refresh() {
    const settings = this.getSettings();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    if (!settings.pat) {
      container.createEl("p", {
        text: "Configure your Asana PAT in plugin settings to get started.",
        cls: "asana-empty",
      });
      return;
    }

    container.createEl("div", { cls: "asana-loading", text: "Loading tasks…" });
    try {
      const api = new AsanaAPI(settings.pat);
      if (!settings.defaultWorkspaceGid) {
        container.empty();
        container.createEl("p", {
          text: 'Set a Default Workspace GID in plugin settings, or click "Connect" to auto-detect.',
          cls: "asana-empty",
        });
        return;
      }
      this.tasks = await api.getMyTasks(settings.defaultWorkspaceGid);
      if (!settings.showCompletedTasks) {
        this.tasks = this.tasks.filter((t) => !t.completed);
      }
      container.empty();
      this.render(container, api);
    } catch (e) {
      container.empty();
      container.createEl("p", { text: "Error: " + e.message, cls: "asana-error" });
    }
  }

  render(container: HTMLElement, api: AsanaAPI) {
    const header = container.createDiv({ cls: "asana-sidebar-header" });
    header.createEl("h4", { text: "My Tasks", cls: "asana-sidebar-title" });
    const controls = header.createDiv({ cls: "asana-sidebar-controls" });
    const refreshBtn = controls.createEl("button", {
      cls: "asana-icon-btn",
      title: "Refresh",
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.refresh());

    if (this.tasks.length === 0) {
      container.createEl("p", { text: "No open tasks.", cls: "asana-empty" });
      return;
    }

    const overdue: AsanaTask[] = [];
    const dueToday: AsanaTask[] = [];
    const upcoming: AsanaTask[] = [];
    const noDue: AsanaTask[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const task of this.tasks) {
      if (!task.due_on) {
        noDue.push(task);
      } else if (task.due_on < today) {
        overdue.push(task);
      } else if (task.due_on === today) {
        dueToday.push(task);
      } else {
        upcoming.push(task);
      }
    }

    if (overdue.length) this.renderSection(container, "⚠ Overdue", overdue, api, true);
    if (dueToday.length) this.renderSection(container, "Today", dueToday, api);
    if (upcoming.length) this.renderSection(container, "Upcoming", upcoming, api);
    if (noDue.length) this.renderSection(container, "No due date", noDue, api);
  }

  renderSection(
    container: HTMLElement,
    title: string,
    tasks: AsanaTask[],
    api: AsanaAPI,
    isOverdue = false
  ) {
    const section = container.createDiv({ cls: "asana-section" });
    section.createEl("h5", {
      text: title,
      cls: "asana-section-title" + (isOverdue ? " asana-overdue-title" : ""),
    });

    const list = section.createEl("ul", { cls: "asana-sidebar-list" });
    for (const task of tasks) {
      const li = list.createEl("li", { cls: "asana-sidebar-item" });
      const checkbox = li.createEl("input", {
        type: "checkbox",
        cls: "asana-task-checkbox",
      }) as HTMLInputElement;
      checkbox.checked = task.completed;

      const info = li.createDiv({ cls: "asana-sidebar-item-info" });
      const link = info.createEl("a", {
        text: task.name,
        href: task.permalink_url,
        cls: "asana-sidebar-task-name",
      });
      if (task.completed) link.addClass("asana-completed");

      if (task.projects.length > 0) {
        info.createEl("span", {
          text: task.projects[0].name,
          cls: "asana-sidebar-project",
        });
      }

      checkbox.addEventListener("change", async () => {
        try {
          if (checkbox.checked) {
            await api.completeTask(task.gid);
          } else {
            await api.uncompleteTask(task.gid);
          }
          link.toggleClass("asana-completed", checkbox.checked);
          li.toggleClass("asana-item-done", checkbox.checked);
        } catch (e) {
          checkbox.checked = !checkbox.checked;
          new Notice("Failed to update task: " + e.message);
        }
      });
    }
  }
}
