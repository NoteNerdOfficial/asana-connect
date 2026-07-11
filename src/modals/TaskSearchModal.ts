import { App, Notice, SuggestModal } from "obsidian";
import { AsanaAPI } from "../api";
import { errorMessage } from "../errors";
import { AsanaPluginSettings, AsanaTask } from "../types";

export class TaskSearchModal extends SuggestModal<AsanaTask> {
  private tasks: AsanaTask[] = [];
  private searchToken = 0;

  constructor(
    app: App,
    private settings: AsanaPluginSettings,
    private onSelect: (task: AsanaTask) => void | Promise<void>
  ) {
    super(app);
    this.setPlaceholder("Search Asana tasks…");
    void this.preload();
  }

  async preload() {
    try {
      const api = new AsanaAPI(this.settings.pat);
      this.tasks = await api.getMyTasks(this.settings.defaultWorkspaceGid);
    } catch (e) {
      // getSuggestions falls back to an empty list until the user types a query
    }
  }

  async getSuggestions(query: string): Promise<AsanaTask[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return this.tasks;
    }

    // debounce: wait, then bail if a newer keystroke has already superseded this one
    const token = ++this.searchToken;
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    if (token !== this.searchToken) {
      return [];
    }

    try {
      const api = new AsanaAPI(this.settings.pat);
      return await api.searchTasks(this.settings.defaultWorkspaceGid, trimmed);
    } catch (e) {
      new Notice("Search failed: " + errorMessage(e));
      return [];
    }
  }

  renderSuggestion(task: AsanaTask, el: HTMLElement) {
    el.createEl("div", { text: task.name });
    if (task.projects.length > 0) {
      el.createEl("small", { text: task.projects.map((p) => p.name).join(", ") });
    }
  }

  onChooseSuggestion(task: AsanaTask) {
    void this.onSelect(task);
  }
}
