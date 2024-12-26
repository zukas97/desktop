
{
  class ZenRiceCollector {
    constructor() {}

    clear() {
      this._userChrome = null;
      this._userContent = null;
      this._enabledMods = null;
      this._preferences = null;
      this._workspaceThemes = null;
    }

    async gatherAll({
        userUserChrome = true, userContent = true,
        enabledMods = true, preferences = true,
        modPrefs = true, workspaceThemes = true } = {}) {
      this.clear();
      // Get the mods first, as they may be needed for the preferences
      if (enabledMods) {
        await this.gatherEnabledMods();
      }
      await Promise.all([
        userUserChrome && this.gatherUserChrome(),
        userContent && this.gatherUserContent(),
        preferences && this.gatherPreferences({ modPrefs }),
        workspaceThemes && this.gatherWorkspaceThemes(),
      ]);
    }

    get profileDir() {
      return PathUtils.profileDir;
    }

    async gatherUserChrome() {
      try {
        const path = PathUtils.join(this.profileDir, 'chrome', 'userChrome.css');
        this._userChrome = await IOUtils.readUTF8(path);
      } catch (e) {
        console.warn("[ZenRiceCollector]: Error reading userChrome.css: ", e);
        return null;
      }
    }

    async gatherUserContent() {
      try {
        const path = PathUtils.join(this.profileDir, 'chrome', 'userContent.css');
        this._userContent = await IOUtils.readUTF8(path);
      } catch (e) {
        console.warn("[ZenRiceCollector]: Error reading userContent.css: ", e);
        return null;
      }
    }

    async gatherEnabledMods() {
      const activeThemes = await gZenThemesImporter.getEnabledThemes();
      if (activeThemes.length === 0) {
        return;
      }
      this._enabledMods = activeThemes;
    }

    _getThemePrefValue(theme, pref) {
      if (pref.type === 'checkbox') {
        return Services.prefs.getBoolPref(pref.property);
      }
      return Services.prefs.getStringPref(pref.property);
    }

    async gatherPreferences({ modPrefs = true } = {}) {
      this._preferences = {};
      if (modPrefs && this._enabledMods) {
        for (const theme of this._enabledMods) {
          const prefs = await ZenThemesCommon.getThemePreferences(theme);
          for (const pref of prefs) {
            this._preferences[pref.property] = this._getThemePrefValue(theme, pref);
          }
        }
      }
      const boolPrefsToCollect = [
        'zen.view.use-single-toolbar',
        'zen.view.sidebar-expanded',
        'zen.tabs.vertical.right-side',
        'zen.view.experimental-no-window-controls',
        'zen.view.hide-window-controls',
      ];
      const stringPrefsToCollect = [
        'browser.uiCustomization.state'
      ];
      for (const pref of boolPrefsToCollect) {
        this._preferences[pref] = Services.prefs.getBoolPref(pref);
      }
      for (const pref of stringPrefsToCollect) {
        this._preferences[pref] = Services.prefs.getStringPref(pref);
      }
    }

    async gatherWorkspaceThemes() {
      const workspaces = (await ZenWorkspaces._workspaces()).workspaces;
      this._workspaceThemes = workspaces.map(w => w.theme);
    }

    async packRice() {
      await this.gatherAll();
      const rice = {
        userChrome: this._userChrome,
        userContent: this._userContent,
        enabledMods: this._enabledMods?.map(t => t.id),
        preferences: this._preferences,
        workspaceThemes: this._workspaceThemes,
      };
      return rice;
    }
  }

  window.gZenRiceCollector = new ZenRiceCollector();
}
