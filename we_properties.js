import { DEFAULTS, settings } from './settings.js';

let applySettingsToSubsystems = null;

window.wallpaperPropertyListener = {
  applyUserProperties: properties => {
    if (!properties) return;
    const changes = {};

    if (properties.themecolorprimary) changes.themecolorprimary = properties.themecolorprimary;
    if (properties.themecolorsecondary) changes.themecolorsecondary = properties.themecolorsecondary;
    if (properties.backgroundcolor) changes.backgroundcolor = properties.backgroundcolor;
    if (properties.linethickness) changes.linethickness = properties.linethickness;
    if (properties.gridenabled) changes.gridenabled = properties.gridenabled;
    if (properties.griddensity) changes.griddensity = properties.griddensity;
    if (properties.audiosensitivity) changes.audiosensitivity = properties.audiosensitivity;
    if (properties.audiosmoothing) changes.audiosmoothing = properties.audiosmoothing;
    if (properties.barscount) changes.barscount = properties.barscount;
    if (properties.waveformenabled) changes.waveformenabled = properties.waveformenabled;
    if (properties.waveformheight) changes.waveformheight = properties.waveformheight;
    if (properties.backgroundequalizeralpha) changes.backgroundequalizeralpha = properties.backgroundequalizeralpha;
    if (properties.nowplayingenabled) changes.nowplayingenabled = properties.nowplayingenabled;
    if (properties.nowplayingcoversize) changes.nowplayingcoversize = properties.nowplayingcoversize;
    if (properties.layoutpreset) changes.layoutpreset = properties.layoutpreset;
    if (properties.hwpollintervalsec) changes.hwpollintervalsec = properties.hwpollintervalsec;
    if (properties.hwmonitorurl !== undefined) changes.hwmonitorurl = properties.hwmonitorurl;
    if (properties.weatherenabled) changes.weatherenabled = properties.weatherenabled;
    if (properties.weatherprovider) changes.weatherprovider = properties.weatherprovider;
    if (properties.weatherapikey) changes.weatherapikey = properties.weatherapikey;
    if (properties.weatherlat !== undefined) changes.weatherlat = properties.weatherlat;
    if (properties.weatherlon !== undefined) changes.weatherlon = properties.weatherlon;
    if (properties.units) changes.units = properties.units;
    if (properties.language) changes.language = properties.language;
    if (properties.textscale) changes.textscale = properties.textscale;
    if (properties.showseconds) changes.showseconds = properties.showseconds;
    if (properties.debugglitchoverlay) changes.debugglitchoverlay = properties.debugglitchoverlay;
    if (properties.diagnosticsenabled) changes.diagnosticsenabled = properties.diagnosticsenabled;
    if (properties.perfprofilerenabled) changes.perfprofilerenabled = properties.perfprofilerenabled;
    if (properties.mooddebug) changes.mooddebug = properties.mooddebug;
    if (properties.debugtextai) changes.debugtextai = properties.debugtextai;
    if (properties.electriceffectsenabled) changes.electriceffectsenabled = properties.electriceffectsenabled;
    if (properties.electricintensity) changes.electricintensity = properties.electricintensity;
    if (properties.electricarccooldown) changes.electricarccooldown = properties.electricarccooldown;
    if (properties.electricladderspeed) changes.electricladderspeed = properties.electricladderspeed;
    if (properties.electricaudioreactive) changes.electricaudioreactive = properties.electricaudioreactive;
    if (properties.semantictextenabled) changes.semantictextenabled = properties.semantictextenabled;
    if (properties.semantictextfrequency) changes.semantictextfrequency = properties.semantictextfrequency;
    if (properties.semantictextverbosity) changes.semantictextverbosity = properties.semantictextverbosity;
    if (properties.semantictextsarcasm) changes.semantictextsarcasm = properties.semantictextsarcasm;
    if (properties.semantictextdegradationstrength)
      changes.semantictextdegradationstrength = properties.semantictextdegradationstrength;
    if (properties.semantictextlanguageprofile) changes.semantictextlanguageprofile = properties.semantictextlanguageprofile;
    if (properties.semantictextidlemode) changes.semantictextidlemode = properties.semantictextidlemode;
    if (properties.textmodestrategy) changes.textmodestrategy = properties.textmodestrategy;
    if (properties.smartcandidatecount) changes.smartcandidatecount = properties.smartcandidatecount;
    if (properties.degradationsensitivity) changes.degradationsensitivity = properties.degradationsensitivity;
    if (properties.robotmodethreshold) changes.robotmodethreshold = properties.robotmodethreshold;
    if (properties.apologyenabled) changes.apologyenabled = properties.apologyenabled;
    if (properties.preemptivewarnings) changes.preemptivewarnings = properties.preemptivewarnings;
    if (properties.whiningintensity) changes.whiningintensity = properties.whiningintensity;
    if (properties.alienalphabetstrength) changes.alienalphabetstrength = properties.alienalphabetstrength;
    if (properties.moodreactivetext) changes.moodreactivetext = properties.moodreactivetext;
    if (properties.moodreactivevisuals) changes.moodreactivevisuals = properties.moodreactivevisuals;
    if (properties.moodaggressiveness) changes.moodaggressiveness = properties.moodaggressiveness;
    if (properties.logenabled) changes.logenabled = properties.logenabled;
    if (properties.logmaxentries) changes.logmaxentries = properties.logmaxentries;
    if (properties.logshowtimestamp) changes.logshowtimestamp = properties.logshowtimestamp;
    if (properties.logfontscale) changes.logfontscale = properties.logfontscale;
    if (properties.logpersistbetweensessions) changes.logpersistbetweensessions = properties.logpersistbetweensessions;
    if (properties.visualprofile) changes.visualprofile = properties.visualprofile;
    if (properties.entropylevel) changes.entropylevel = properties.entropylevel;
    if (properties.behaviormemoryenabled) changes.behaviormemoryenabled = properties.behaviormemoryenabled;
    if (properties.narrativeeventsenabled) changes.narrativeeventsenabled = properties.narrativeeventsenabled;
    if (properties.degradationenabled) changes.degradationenabled = properties.degradationenabled;
    if (properties.timeofdayadaptive) changes.timeofdayadaptive = properties.timeofdayadaptive;
    if (properties.glitchesenabled) changes.glitchesenabled = properties.glitchesenabled;
    if (properties.glitchintervalminsec) changes.glitchintervalminsec = properties.glitchintervalminsec;
    if (properties.glitchintervalmaxsec) changes.glitchintervalmaxsec = properties.glitchintervalmaxsec;
    if (properties.glitchintensity) changes.glitchintensity = properties.glitchintensity;
    if (properties.musicreactiveglitches) changes.musicreactiveglitches = properties.musicreactiveglitches;
    if (properties.localglitchesenabled) changes.localglitchesenabled = properties.localglitchesenabled;
    if (properties.localglitchintensityboost) changes.localglitchintensityboost = properties.localglitchintensityboost;
    if (properties.localglitchfrequencyboost) changes.localglitchfrequencyboost = properties.localglitchfrequencyboost;
    if (properties.allowtwoblockglitches) changes.allowtwoblockglitches = properties.allowtwoblockglitches;
    if (properties.maxsimultaneousglitches) changes.maxsimultaneousglitches = properties.maxsimultaneousglitches;
    if (properties.allowscreenwideeffects) changes.allowscreenwideeffects = properties.allowscreenwideeffects;
    if (properties.bigeventchance) changes.bigeventchance = properties.bigeventchance;
    if (properties.chromaticaberrationenabled)
      changes.chromaticaberrationenabled = properties.chromaticaberrationenabled;
    if (properties.aliensymbolset !== undefined) changes.aliensymbolset = properties.aliensymbolset;
    if (properties.interactivityenabled) changes.interactivityenabled = properties.interactivityenabled;
    if (properties.hovereffectsenabled) changes.hovereffectsenabled = properties.hovereffectsenabled;
    if (properties.clickeffectsenabled) changes.clickeffectsenabled = properties.clickeffectsenabled;
    if (properties.cursortrailenabled) changes.cursortrailenabled = properties.cursortrailenabled;
    if (properties.parallaxenabled) changes.parallaxenabled = properties.parallaxenabled;
    if (properties.interactivecontrolsenabled) changes.interactivecontrolsenabled = properties.interactivecontrolsenabled;
    if (properties.hiddengesturesenabled) changes.hiddengesturesenabled = properties.hiddengesturesenabled;
    if (properties.idletimeoutsec) changes.idletimeoutsec = properties.idletimeoutsec;
    if (properties.uiresponsiveness) changes.uiresponsiveness = properties.uiresponsiveness;
    if (properties.tooltipsenabled) changes.tooltipsenabled = properties.tooltipsenabled;
    if (properties.thresholdscpuhigh) changes.thresholdscpuhigh = properties.thresholdscpuhigh;
    if (properties.thresholdsgpuhigh) changes.thresholdsgpuhigh = properties.thresholdsgpuhigh;
    if (properties.thresholdsnethigh) changes.thresholdsnethigh = properties.thresholdsnethigh;
    if (properties.externalipenabled) changes.externalipenabled = properties.externalipenabled;

    const changedKeys = settings.applyFromWE(changes);
    if (applySettingsToSubsystems && changedKeys.size) {
      applySettingsToSubsystems(changedKeys);
    }
  },
};

export function installWallpaperPropertyListener(nextApplySettings) {
  applySettingsToSubsystems = typeof nextApplySettings === 'function' ? nextApplySettings : null;
  if (applySettingsToSubsystems) {
    applySettingsToSubsystems(new Set(Object.keys(DEFAULTS)));
  }
}
