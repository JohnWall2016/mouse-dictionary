/**
 * Mouse Dictionary (https://github.com/wtetsu/mouse-dictionary/)
 * Copyright 2018-present wtetsu
 * Licensed under MIT
 */

import React from "react";
import swal from "sweetalert";
import LoadDictionary from "./LoadDictionary";
import BasicSettings from "./BasicSettings";
import AdvancedSettings from "./AdvancedSettings";
import PersistenceSettings from "./PersistenceSettings";
import res from "../lib/resources";
import dict from "../lib/dict";
import defaultSettings from "../../settings/defaultsettings";
import text from "../../lib/text";
import dom from "../../lib/dom";
import env from "../../settings/env";
import ContentGenerator from "../../main/contentgenerator";
import mdwindow from "../../main/mdwindow";
import storage from "../../lib/storage";
import utils from "../lib/utils";

const KEY_LOADED = "**** loaded ****";
const KEY_USER_CONFIG = "**** config ****";

export default class Main extends React.Component {
  constructor(props) {
    super(props);
    const initialLang = utils.decideInitialLanguage(navigator.languages);
    res.setLang(initialLang);
    this.state = {
      encoding: "Shift-JIS",
      format: "EIJIRO",
      dictDataUsage: "-",
      busy: false,
      progress: "",
      settings: null,
      trialText: "rained cats and dogs",
      basicSettingsOpened: false,
      advancedSettingsOpened: false,
      lang: initialLang,
      initialized: false
    };

    this.doChangeState = this.doChangeState.bind(this);
    this.doChangeSettings = this.doChangeSettings.bind(this);
    this.doChangeColorSettings = this.doChangeColorSettings.bind(this);
    this.doChangeReplaceRule = this.doChangeReplaceRule.bind(this);
    this.doMoveReplaceRule = this.doMoveReplaceRule.bind(this);
    this.doRemoveReplaceRule = this.doRemoveReplaceRule.bind(this);
    this.doLoad = this.doLoad.bind(this);
    this.doClear = this.doClear.bind(this);
    this.doSaveSettings = this.doSaveSettings.bind(this);
    this.doBackToDefaultSettings = this.doBackToDefaultSettings.bind(this);
    this.doAddReplaceRule = this.doAddReplaceRule.bind(this);
    this.doToggleBasicSettings = this.doToggleBasicSettings.bind(this);
    this.doToggleAdvancedSettings = this.doToggleAdvancedSettings.bind(this);
    this.doSwitchLanguage = this.doSwitchLanguage.bind(this);
  }

  render() {
    const state = this.state;

    return (
      <div>
        <div onClick={this.doSwitchLanguage} style={{ position: "absolute", top: 0, left: -30, cursor: "pointer" }}>
          {this.state.lang}
        </div>
        <LoadDictionary
          encoding={state.encoding}
          format={state.format}
          onChangeState={this.doChangeState}
          doLoad={this.doLoad}
          doClear={this.doClear}
          dictDataUsage={state.dictDataUsage}
          busy={state.busy}
          progress={state.progress}
        />

        <img
          src="loading.gif"
          width="32"
          height="32"
          style={{ verticalAlign: "middle", display: this.state.initialized ? "none" : "inline" }}
        />

        {!env.disableUserSettings && this.state.initialized && <hr />}

        {!env.disableUserSettings && this.state.initialized && (
          <div>
            <img src="settings1.png" style={{ verticalAlign: "bottom" }} />
            <a onClick={this.doToggleBasicSettings} style={{ cursor: "pointer" }}>
              {this.state.basicSettingsOpened ? res.get("closeBasicSettings") : res.get("openBasicSettings")}
            </a>
          </div>
        )}

        <br />

        {(this.state.basicSettingsOpened || this.state.advancedSettingsOpened) && (
          <PersistenceSettings
            onClickSaveSettings={this.doSaveSettings}
            onClickBackToDefaultSettings={this.doBackToDefaultSettings}
          />
        )}

        {this.state.basicSettingsOpened && (
          <BasicSettings
            onChange={this.doChangeSettings}
            onChangeState={this.doChangeState}
            onChangeSettings={this.doChangeSettings}
            onChangeColorSettings={this.doChangeColorSettings}
            settings={state.settings}
            trialText={state.trialText}
          />
        )}

        <br />
        {this.state.basicSettingsOpened && (
          <div style={{ fontSize: "10px" }}>
            <img src="settings2.png" style={{ verticalAlign: "bottom" }} />
            <a onClick={this.doToggleAdvancedSettings} style={{ cursor: "pointer" }}>
              {this.state.advancedSettingsOpened ? res.get("closeAdvancedSettings") : res.get("openAdvancedSettings")}
            </a>
          </div>
        )}

        <br />

        {this.state.advancedSettingsOpened && (
          <AdvancedSettings
            onChange={this.doChangeSettings}
            onChangeState={this.doChangeState}
            onChangeSettings={this.doChangeSettings}
            onChangeReplaceRule={this.doChangeReplaceRule}
            onClickAddReplaceRule={this.doAddReplaceRule}
            onClickMoveReplaceRule={this.doMoveReplaceRule}
            onClickRemoveReplaceRule={this.doRemoveReplaceRule}
            settings={state.settings}
          />
        )}
      </div>
    );
  }

  async componentDidMount() {
    const isLoaded = await storage.local.pickOut(KEY_LOADED);
    if (!isLoaded) {
      this.registerDefaultDict();
    }
    await this.initializeUserSettings();
    await this.updateDictDataUsage();
    this.setState({ initialized: true });
  }

  async initializeUserSettings() {
    const userSettingsJson = await storage.sync.pickOut(KEY_USER_CONFIG);
    const userSettings = utils.tryToParseJson(userSettingsJson);
    const settings = Object.assign({}, defaultSettings, userSettings);
    this.setState({ settings });
    this.contentGenerator = new ContentGenerator(settings);
    setInterval(() => {
      if (!this.newSettingsTime) {
        return;
      }
      if (this.newSettingsTime + 100 <= new Date().getTime()) {
        this.updateTrialWindow(this.newSettings);
        this.newSettingsTime = null;
        this.newSettings = null;
      }
    }, 10);
  }

  async updateDictDataUsage() {
    const byteSize = await storage.local.getBytesInUse();
    const kb = isFinite(byteSize) ? Math.floor(byteSize / 1024).toLocaleString() : "";
    this.setState({
      dictDataUsage: res.get("dictDataUsage", kb)
    });
  }

  async registerDefaultDict() {
    const willLoad = await swal({
      text: res.get("confirmLoadInitialDict"),
      icon: "info",
      buttons: true,
      closeOnClickOutside: false
    });
    if (!willLoad) {
      return;
    }
    this.setState({ busy: true });
    const { wordCount } = await dict.registerDefaultDict(progress => {
      this.setState({ dictDataUsage: progress });
    });

    this.updateDictDataUsage();
    this.setState({ busy: false, progress: "" });

    const loaded = {};
    loaded[KEY_LOADED] = true;
    await storage.local.set(loaded);

    await swal({
      text: res.get("finishRegister", wordCount),
      icon: "success"
    });
  }

  doChangeState(name, e) {
    if (name) {
      const newState = {};
      newState[name] = e.target.value;
      this.setState(newState);

      if (name === "trialText") {
        this.updateTrialText(this.state.settings, e.target.value);
      }
    }
  }

  doChangeSettings(name, e) {
    if (!name) {
      return;
    }
    const newSettings = Object.assign({}, this.state.settings);
    let newValue;
    switch (e.target.type) {
      case "number":
        newValue = parseInt(e.target.value, 10);
        break;
      case "checkbox":
        newValue = e.target.checked;
        break;
      default:
        newValue = e.target.value;
    }
    newSettings[name] = newValue;

    this.setState({
      settings: newSettings
    });
    this.setUpdateTrialWindowTimer(newSettings);
  }

  doChangeColorSettings(name, e) {
    if (!name) {
      return;
    }
    const newSettings = Object.assign({}, this.state.settings);
    newSettings[name] = e.hex;
    this.setState({
      settings: newSettings
    });
    this.setUpdateTrialWindowTimer(newSettings);
  }

  setUpdateTrialWindowTimer(newSettings) {
    this.newSettingsTime = new Date().getTime();
    this.newSettings = newSettings;
  }

  async doLoad() {
    const file = document.getElementById("dictdata").files[0];
    if (!file) {
      swal({
        title: res.get("selectDictFile"),
        icon: "info"
      });
      return;
    }
    const encoding = this.state.encoding;
    const format = this.state.format;
    const event = ev => {
      switch (ev.name) {
        case "reading": {
          const loaded = ev.loaded.toLocaleString();
          const total = ev.total.toLocaleString();
          this.setState({ progress: `${loaded} / ${total} Byte` });
          break;
        }
        case "loading": {
          this.setState({ progress: res.get("progressRegister", ev.count, ev.word.head) });
          break;
        }
      }
    };
    this.setState({ busy: true });
    try {
      const { wordCount } = await dict.load({ file, encoding, format, event });
      swal({
        text: res.get("finishRegister", wordCount),
        icon: "success"
      });
      const loaded = {};
      loaded[KEY_LOADED] = true;
      storage.local.set(loaded);

      this.updateDictDataUsage();
    } catch (e) {
      swal({
        text: e.toString(),
        icon: "error"
      });
    } finally {
      this.setState({ busy: false, progress: "" });
    }
  }

  async doClear() {
    const willDelete = await swal({
      text: res.get("clearAllDictData"),
      icon: "warning",
      buttons: true,
      dangerMode: true
    });
    if (!willDelete) {
      return;
    }

    this.setState({ busy: true });
    await storage.local.clear();
    swal({
      text: res.get("finishedClear"),
      icon: "success"
    });
    this.setState({ busy: false });
    this.updateDictDataUsage();
  }

  doAddReplaceRule() {
    const newReplaceRules = [].concat(this.state.settings.replaceRules);
    newReplaceRules.push({ key: new Date().toString(), search: "", replace: "" });

    const newSettings = Object.assign({}, this.state.settings);
    newSettings.replaceRules = newReplaceRules;
    this.setState({
      settings: newSettings
    });
    this.setUpdateTrialWindowTimer(newSettings);
  }

  doChangeReplaceRule(e) {
    // name: replaceRule.search.0
    const name = e.target.name;
    if (!name) {
      return;
    }
    const arr = name.split(".");
    if (arr.length !== 3 || arr[0] !== "replaceRule") {
      return;
    }
    const type = arr[1];
    const index = parseInt(arr[2], 10);
    const newReplaceRules = [].concat(this.state.settings.replaceRules);
    if (index < newReplaceRules.length) {
      switch (type) {
        case "search":
          newReplaceRules[index].search = e.target.value;
          break;
        case "replace":
          newReplaceRules[index].replace = e.target.value;
          break;
      }
      this.updateReplaceRules(newReplaceRules);
    }
  }

  doMoveReplaceRule(index, offset) {
    const newReplaceRules = [].concat(this.state.settings.replaceRules);
    const a = newReplaceRules[index];
    const b = newReplaceRules[index + offset];
    if (a && b) {
      newReplaceRules[index] = b;
      newReplaceRules[index + offset] = a;
      this.updateReplaceRules(newReplaceRules);
    }
  }

  doRemoveReplaceRule(index) {
    const newReplaceRules = [].concat(this.state.settings.replaceRules);
    newReplaceRules.splice(index, 1);
    this.setState(newReplaceRules);
    this.updateReplaceRules(newReplaceRules);
  }

  updateReplaceRules(newReplaceRules) {
    const newSettings = Object.assign({}, this.state.settings);
    newSettings.replaceRules = newReplaceRules;
    this.setState({
      settings: newSettings
    });
    this.updateTrialWindow(newSettings);
  }

  updateTrialWindow(settings) {
    if (!settings) {
      return;
    }
    this.removeTrialWindow();
    try {
      this.contentGenerator = new ContentGenerator(settings);
      this.trialWindow = mdwindow.create(settings);
      this.trialWindow.dialog.style.cursor = "zoom-out";
      this.trialWindow.dialog.addEventListener("click", () => {
        this.trialWindow.dialog.style.width = "100px";
        this.trialWindow.dialog.style.height = "100px";
      });
      document.body.appendChild(this.trialWindow.dialog);

      this.updateTrialText(settings);
    } catch (e) {
      this.contentGenerator = null;
    }
  }

  removeTrialWindow() {
    if (this.trialWindow && this.trialWindow.dialog) {
      document.body.removeChild(this.trialWindow.dialog);
      this.trialWindow = null;
    }
  }

  async updateTrialText(settings, trialText) {
    if (!this.trialWindow) {
      return;
    }
    const actualTrialText = trialText || this.state.trialText;

    const code = actualTrialText.charCodeAt(0);
    const isEnglishLike = 0x20 <= code && code <= 0x7e;
    const wordsToLookup = text.createLookupWords(
      actualTrialText,
      settings.lookupWithCapitalized && isEnglishLike,
      false,
      isEnglishLike
    );

    let startTime;
    if (process.env.NODE_ENV !== "production") {
      startTime = new Date().getTime();
      console.info(wordsToLookup);
    }

    const descriptions = await storage.local.get(wordsToLookup);
    const { html } = await this.contentGenerator.generate(wordsToLookup, descriptions, isEnglishLike);

    if (this.trialWindow) {
      const newDom = dom.create(html);
      this.trialWindow.content.innerHTML = "";
      this.trialWindow.content.appendChild(newDom);
    }

    if (process.env.NODE_ENV !== "production") {
      const time = new Date().getTime() - startTime;
      console.info(`${time}ms:${wordsToLookup}`);
    }
  }

  async doSaveSettings() {
    const settings = Object.assign({}, this.state.settings);
    if (settings.replaceRules) {
      settings.replaceRules = settings.replaceRules.filter(r => r.search && r.replace);
    }
    const newData = {};
    newData[KEY_USER_CONFIG] = JSON.stringify(settings);
    await storage.sync.set(newData);
    swal({
      text: res.get("finishSaving"),
      icon: "info"
    });
  }

  doBackToDefaultSettings() {
    const settings = Object.assign({}, defaultSettings);
    this.setState({ settings });
    this.updateTrialWindow(settings);
  }

  doToggleBasicSettings() {
    this.updateTrialWindow(this.state.settings);

    if (this.state.basicSettingsOpened) {
      this.setState({
        basicSettingsOpened: false,
        advancedSettingsOpened: false
      });
      this.removeTrialWindow();
    } else {
      this.setState({
        basicSettingsOpened: true,
        advancedSettingsOpened: false
      });
    }
  }

  doToggleAdvancedSettings() {
    this.setState({
      advancedSettingsOpened: !this.state.advancedSettingsOpened
    });
  }

  doSwitchLanguage() {
    const newLang = this.state.lang === "ja" ? "en" : "ja";
    res.setLang(newLang);
    this.setState({
      lang: newLang
    });
  }
}
