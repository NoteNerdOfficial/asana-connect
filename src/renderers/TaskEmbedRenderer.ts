import { MarkdownRenderChild } from "obsidian";
import { AsanaAPI } from "../api";
import { errorMessage } from "../errors";
import { AsanaPluginSettings, AsanaTask } from "../types";

export class TaskEmbedRenderer extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private source: string,
    private settings: AsanaPluginSettings
  ) {
    super(containerEl);
  }

  onload() {
    void this.render();
  }

  async render() {
    this.containerEl.empty();
    const loading = this.containerEl.createDiv({ cls: "asana-loading" });
    loading.setText("Loading Asana task…");
    try {
      const gid = this.resolveGid(this.source.trim());
      if (!gid) {
        this.renderError("Could not parse task ID from: " + this.source.trim());
        return;
      }
      const api = new AsanaAPI(this.settings.pat);
      const task = await api.getTask(gid);
      this.containerEl.empty();
      this.renderTask(task);
    } catch (e) {
      this.renderError(errorMessage(e));
    }
  }

  resolveGid(raw: string): string | null {
    if (/^\d+$/.test(raw)) return raw;
    const match = raw.match(/\/(\d+)\/?(?:\?|$|\/f)/);
    return match ? match[1] : null;
  }

  renderTask(task: AsanaTask) {
    const wrap = this.containerEl.createDiv({ cls: "asana-task-embed" });
    const header = wrap.createDiv({ cls: "asana-task-header" });

    const checkbox = header.createEl("input", {
      type: "checkbox",
      cls: "asana-task-checkbox",
    });
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => {
      void this.toggleComplete(task, checkbox, titleEl);
    });

    const titleEl = header.createEl("a", {
      text: task.name,
      href: task.permalink_url,
      cls: "asana-task-title",
    });
    if (task.completed) titleEl.addClass("asana-completed");

    const meta = wrap.createDiv({ cls: "asana-task-meta" });
    if (task.assignee) {
      meta.createSpan({
        cls: "asana-meta-chip asana-assignee",
        text: `\u{1F464} ${task.assignee.name}`,
      });
    }
    if (task.due_on) {
      const due = new Date(task.due_on);
      const overdue = !task.completed && due < new Date();
      meta.createSpan({
        cls: "asana-meta-chip asana-due" + (overdue ? " asana-overdue" : ""),
        text: `\u{1F4C5} ${task.due_on}`,
      });
    }
    if (task.projects.length > 0) {
      const proj = meta.createSpan({ cls: "asana-meta-chip asana-project" });
      proj.setText("\u{1F4C1} " + task.projects.map((p) => p.name).join(", "));
    }

    if (task.notes) {
      const notes = wrap.createDiv({ cls: "asana-task-notes" });
      notes.setText(task.notes.length > 300 ? task.notes.slice(0, 300) + "…" : task.notes);
    }

    if (task.custom_fields && task.custom_fields.length > 0) {
      const fields = wrap.createDiv({ cls: "asana-custom-fields" });
      for (const cf of task.custom_fields) {
        if (!cf.display_value) continue;
        const row = fields.createDiv({ cls: "asana-cf-row" });
        row.createSpan({ cls: "asana-cf-name", text: cf.name + ":" });
        row.createSpan({ cls: "asana-cf-value", text: cf.display_value });
      }
    }
  }

  async toggleComplete(task: AsanaTask, checkbox: HTMLInputElement, titleEl: HTMLElement) {
    try {
      const api = new AsanaAPI(this.settings.pat);
      if (checkbox.checked) {
        await api.completeTask(task.gid);
      } else {
        await api.uncompleteTask(task.gid);
      }
      titleEl.toggleClass("asana-completed", checkbox.checked);
    } catch (e) {
      checkbox.checked = !checkbox.checked;
    }
  }

  renderError(msg: string) {
    this.containerEl.empty();
    const err = this.containerEl.createDiv({ cls: "asana-error" });
    err.setText("Asana: " + msg);
  }
}
