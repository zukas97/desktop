
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

  class ZenRiceManager {
    constructor() {
      this._collector = new ZenRiceCollector();
    }

    async packRice() {
      return this._collector.packRice();
    }

    get shareDialog() {
      if (this._shareDialog) {
        return this._shareDialog;
      }
      this._shareDialog = window.MozXULElement.parseXULToFragment(`
        <vbox id="zen-rice-share-dialog" hidden="true">
          <html:img src="chrome://browser/content/zen-images/brand-header.svg" class="zen-rice-share-header" />
          <vbox class="zen-rice-share-content">
            <html:input type="text" data-l10n-id="zen-rice-share-name" id="zen-rice-share-name" oninput="gZenThemePicker.riceManager.validateShareDialog(this)" />
            <hbox class="zen-rice-share-author">
              <label data-l10n-id="zen-rice-share-author" />
              <html:input type="text" data-l10n-id="zen-rice-share-author-input" id="zen-rice-share-author" />
            </hbox>
            <vbox zen-collapsed="true" id="zen-rice-share-options" onclick="gZenThemePicker.riceManager.toggleOptions(event)">
              <hbox class="options-header">
                <label data-l10n-id="zen-rice-share-include" />
                <image></image>
              </hbox>
              <checkbox data-l10n-id="zen-rice-share-include-userchrome" id="zen-rice-share-include-userchrome" />
              <checkbox data-l10n-id="zen-rice-share-include-usercontent" id="zen-rice-share-include-usercontent" />
              <checkbox data-l10n-id="zen-rice-share-include-mods" id="zen-rice-share-include-mods" />
              <vbox class="indent">
                <checkbox data-l10n-id="zen-rice-share-include-mod-prefs" id="zen-rice-share-include-mod-prefs" />
              </vbox>
              <checkbox data-l10n-id="zen-rice-share-include-preferences" id="zen-rice-share-include-preferences" />
              <checkbox data-l10n-id="zen-rice-share-include-workspace-themes" id="zen-rice-share-include-workspace-themes" />
            </vbox>
            <html:moz-button-group class="panel-footer">
              <button onclick="gZenThemePicker.riceManager.cancel()" class="footer-button" data-l10n-id="zen-rice-share-cancel" />
              <button onclick="gZenThemePicker.riceManager.submit()" class="footer-button" data-l10n-id="zen-rice-share-save" default="true" slot="primary" id="zen-rice-share-save" disabled="true" />
            </html:moz-button-group>
          </vbox>
        </vbox>
      `);
      document.getElementById("zen-main-app-wrapper").appendChild(this._shareDialog);
      this._shareDialog = document.getElementById("zen-rice-share-dialog");
      return this._shareDialog;
    }

    toggleOptions(event) {
      if (event.originalTarget.closest(".options-header")) {
        const options = document.getElementById("zen-rice-share-options");
        options.setAttribute("zen-collapsed", options.getAttribute("zen-collapsed") === "true" ? "false" : "true");
      }
      this.validateShareDialog(document.getElementById("zen-rice-share-name"));
    }

    openShareDialog() {
      window.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow)
        .rollupAllPopups();

      const dialog = this.shareDialog;
      dialog.removeAttribute("hidden");

      // Initialize the dialog with the current values
      this.validateShareDialog(document.getElementById("zen-rice-share-name"));
    }

    cancel() {
      this.shareDialog.setAttribute("hidden", "true");
      document.getElementById("zen-rice-share-name").value = "";
      document.getElementById("zen-rice-share-author").value = "";
      document.getElementById("zen-rice-share-save").disabled = true;
    }

    getAllowedRice() {
      return {
        userChrome: document.getElementById("zen-rice-share-include-userchrome").checked,
        userContent: document.getElementById("zen-rice-share-include-usercontent").checked,
        mods: document.getElementById("zen-rice-share-include-mods").checked,
        modPrefs: document.getElementById("zen-rice-share-include-mod-prefs").checked,
        preferences: document.getElementById("zen-rice-share-include-preferences").checked,
        workspaceThemes: document.getElementById("zen-rice-share-include-workspace-themes").checked,
      };
    }

    canShareRice() {
      const allowedRice = this.getAllowedRice();
      const modsPrefs = document.getElementById("zen-rice-share-include-mod-prefs");
      // remove "share mod prefs" if mods are not included
      if (!allowedRice.mods) {
        allowedRice.modPrefs = false;
        modsPrefs.disabled = true;
      }
      modsPrefs.disabled = !allowedRice.mods;
      return Object.values(allowedRice).some(v => v);
    }

    validateShareDialog(input) {
      const saveButton = document.getElementById("zen-rice-share-save");
      saveButton.disabled = !this.canShareRice() || input.value.trim().length < 3 || input.value.trim().length > 30;
    }

    async submit() {
    }
  }

  window.ZenRiceManager = ZenRiceManager;
}
