import { MarkdownRenderChild, Notice, setIcon } from "obsidian";
import { AsanaAPI } from "../api";
import { AsanaPluginSettings, AsanaTask } from "../types";

interface TaskListOptions {
  mode: "my-tasks" | "project";
  workspaceGid?: string;
  projectGid?: string;
  limit?: number;
  showCompleted?: boolean;
  title?: string;
}

export class TaskListRenderer extends MarkdownRenderChild {
  private options: TaskListOptions;

  constructor(
    containerEl: HTMLElement,
    private source: string,
    private settings: AsanaPluginSettings
  ) {
    super(containerEl);
    this.options = this.parseOptions(source);
  }

  async onload() {
    await this.render();
  }

  parseOptions(source: string): TaskListOptions {
    const opts: TaskListOptions = {
      mode: "my-tasks",
      workspaceGid: this.settings.defaultWorkspaceGid,
    };
    for (const line of source.split("\n")) {
      const [key, ...rest] = line.split(":").map((s) => s.trim());
      const value = rest.join(":").trim();
      if (!value) continue;
      switch (key) {
        case "mode":
          opts.mode = value as TaskListOptions["mode"];
          break;
        case "project":
          opts.projectGid = value;
          break;
        case "workspace":
          opts.workspaceGid = value;
          break;
        case "limit":
          opts.limit = parseInt(value) || 20;
          break;
        case "show-completed":
          opts.showCompleted = value === "true";
          break;
        case "title":
          opts.title = value.replace(/^["']|["']$/g, "");
          break;
      }
    }
    return opts;
  }

  async render() {
    this.containerEl.empty();
    const loading = this.containerEl.createDiv({ cls: "asana-loading" });
    loading.setText("Loading tasks…");
    try {
      const api = new AsanaAPI(this.settings.pat);
      let tasks: AsanaTask[] = [];
      if (this.options.mode === "project" && this.options.projectGid) {
        tasks = await api.getProjectTasks(this.options.projectGid);
      } else if (this.options.workspaceGid) {
        tasks = await api.getMyTasks(this.options.workspaceGid);
      } else {
        throw new Error(
          'No workspace GID set. Add "workspace: <gid>" to the block or configure a default in settings.'
        );
      }

      const showCompleted = this.options.showCompleted ?? this.settings.showCompletedTasks;
      if (!showCompleted) {
        tasks = tasks.filter((t) => !t.completed);
      }
      if (this.options.limit) {
        tasks = tasks.slice(0, this.options.limit);
      }

      this.containerEl.empty();
      this.renderList(tasks, api);
    } catch (e) {
      this.containerEl.empty();
      const err = this.containerEl.createDiv({ cls: "asana-error" });
      err.setText("Asana: " + e.message);
    }
  }

  renderList(tasks: AsanaTask[], api: AsanaAPI) {
    const wrap = this.containerEl.createDiv({ cls: "asana-task-list" });
    const titleText =
      this.options.title || (this.options.mode === "project" ? "Project Tasks" : "My Tasks");

    const titleRow = wrap.createDiv({ cls: "asana-list-header" });
    titleRow.createEl("h4", { text: titleText, cls: "asana-list-title" });
    const refreshBtn = titleRow.createEl("button", {
      cls: "asana-refresh-btn",
      title: "Refresh",
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.render());

    if (tasks.length === 0) {
      wrap.createDiv({ cls: "asana-empty", text: "No tasks found." });
      return;
    }

    const list = wrap.createEl("ul", { cls: "asana-task-list-items" });
    for (const task of tasks) {
      const li = list.createEl("li", { cls: "asana-task-list-item" });
      const checkbox = li.createEl("input", {
        type: "checkbox",
        cls: "asana-task-checkbox",
      }) as HTMLInputElement;
      checkbox.checked = task.completed;

      const info = li.createDiv({ cls: "asana-task-list-info" });
      const link = info.createEl("a", {
        text: task.name,
        href: task.permalink_url,
        cls: "asana-task-list-name",
      });
      if (task.completed) link.addClass("asana-completed");

      const sub = info.createDiv({ cls: "asana-task-list-sub" });
      if (task.due_on) {
        const overdue = !task.completed && new Date(task.due_on) < new Date();
        sub.createSpan({
          cls: "asana-meta-chip asana-due" + (overdue ? " asana-overdue" : ""),
          text: task.due_on,
        });
      }
      if (task.assignee) {
        sub.createSpan({ cls: "asana-meta-chip", text: task.assignee.name });
      }

      checkbox.addEventListener("change", async () => {
        try {
          if (checkbox.checked) {
            await api.completeTask(task.gid);
          } else {
            await api.uncompleteTask(task.gid);
          }
          link.toggleClass("asana-completed", checkbox.checked);
        } catch (e) {
          checkbox.checked = !checkbox.checked;
          new Notice("Failed to update task: " + e.message);
        }
      });
    }
  }
}
