import { App, FuzzySuggestModal, Notice } from "obsidian";
import { AsanaAPI } from "../api";
import { AsanaPluginSettings, AsanaTask } from "../types";

export class TaskSearchModal extends FuzzySuggestModal<AsanaTask> {
  private tasks: AsanaTask[] = [];
  private loaded = false;

  constructor(
    app: App,
    private settings: AsanaPluginSettings,
    private onSelect: (task: AsanaTask) => void
  ) {
    super(app);
    this.setPlaceholder("Search Asana tasks…");
    this.preload();
  }

  async preload() {
    try {
      const api = new AsanaAPI(this.settings.pat);
      this.tasks = await api.getMyTasks(this.settings.defaultWorkspaceGid);
      this.loaded = true;
    } catch (e) {
      // search-as-you-type below will still work once results arrive
    }
  }

  getItems(): AsanaTask[] {
    return this.tasks;
  }

  getItemText(task: AsanaTask): string {
    return task.name + " " + (task.projects.map((p) => p.name).join(" ") || "");
  }

  onChooseItem(task: AsanaTask) {
    this.onSelect(task);
  }

  async onOpen() {
    super.onOpen();
    const inputEl = this.inputEl;
    let debounceTimer: number;
    inputEl.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      const query = inputEl.value.trim();
      if (query.length < 2) return;
      debounceTimer = window.setTimeout(async () => {
        try {
          const api = new AsanaAPI(this.settings.pat);
          const results = await api.searchTasks(this.settings.defaultWorkspaceGid, query);
          this.tasks = results;
          (this as any).updateSuggestions();
        } catch (e) {
          new Notice("Search failed: " + e.message);
        }
      }, 400);
    });
  }
}
