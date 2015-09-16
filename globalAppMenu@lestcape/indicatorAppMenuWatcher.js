// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

const Lang = imports.lang;
const Signals = imports.signals;

const Main = imports.ui.main;

const AppletPath = imports.ui.appletManager.applets['globalAppMenu@lestcape'];
const DBusMenu = AppletPath.dbusMenu;
const DBusRegistrar = DBusMenu.loadInterfaceXml("DBusRegistrar.xml");

const WATCHER_INTERFACE = 'com.canonical.AppMenu.Registrar';
const WATCHER_OBJECT = '/com/canonical/AppMenu/Registrar';

const AppmenuMode = {
   MODE_STANDARD: 0,
   MODE_UNITY: 1,
   MODE_UNITY_ALL_MENUS: 2
};

const LOG_NAME = "Indicator AppMenu Whatcher:";

//Some GTK APP that use Register iface or not export the menu.
const GTK_BLACKLIST = [
   "firefox.desktop",
   "thunderbird.desktop",
   "blender-fullscreen.desktop",
   "blender-windowed.desktop"
];

function SystemProperties() {
   this._init.apply(this, arguments);
}

SystemProperties.prototype = {

   _init: function() {
      this.xSetting = new Gio.Settings({ schema: 'org.cinnamon.settings-daemon.plugins.xsettings' });
   },

   shellShowAppmenu: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsAppMenu', show);
   },

   shellShowMenubar: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsMenubar', show);
   },

   activeJAyantanaModule: function(active) {
      if(active) {
         let file = Gio.file_new_for_path("/usr/share/java/jayatanaag.jar");
         if(file.query_exists(null)) {
             GLib.setenv('JAYATANA', "1", true);
             GLib.setenv('JAYATANA_FORCE', "1", true);
             GLib.setenv('JAVA_TOOL_OPTIONS', "-javaagent:/usr/share/java/jayatanaag.jar", true);
          }
      } else {
          GLib.setenv('JAYATANA', "0", true);
          //GLib.unsetenv('JAYATANA');
          //GLib.unsetenv('JAYATANA_FORCE');
          //GLib.unsetenv('JAVA_TOOL_OPTIONS');
      }
   },

   activeUnityGtkModule: function(active) {
      let isReady = false;
      let envGtk = this._getEnvGtkModules();
      let xSettingGtk = this._getXSettingGtkModules();
      if(active) {
         if(envGtk) {
            if(envGtk.indexOf("unity-gtk-module") == -1) {
               envGtk.push("unity-gtk-module");
               this._setEnvGtkModules(envGtk);
            } else {
               isReady = true;
            }
         } else  {
            envGtk = ["unity-gtk-module"];
            this._setEnvGtkModules(envGtk);
         }
         if(xSettingGtk) {
            if(xSettingGtk.indexOf("unity-gtk-module") == -1) {
               xSettingGtk.push("unity-gtk-module");
               this._setXSettingGtkModules(xSettingGtk);
            } else {
               isReady = true;
            }
         } else  {
            xSettingGtk = ["unity-gtk-module"];
            this._setXSettingGtkModules(xSettingGtk);
         }
      } else {
         if(envGtk) {
            let pos = envGtk.indexOf("unity-gtk-module")
            if(pos != -1) {
               envGtk.splice(pos, -1);
               this._setEnvGtkModules(envGtk);
            } else {
               isReady = true;
            }
         } else if(xSettingGtk) {
            let pos = xSettingGtk.indexOf("unity-gtk-module")
            if(pos != -1) {
               xSettingGtk.splice(pos, -1);
               this._setXSettingGtkModules(xSettingGtk);
            } else {
               isReady = true;
            }
         } else  {
            isReady = true;
         }
      }
      return isReady;
   },

   activeUnityMenuProxy: function(active) {
      let envMenuProxy = GLib.getenv('UBUNTU_MENUPROXY');
      if(envMenuProxy != "1") {
         GLib.setenv('UBUNTU_MENUPROXY', "1", true);
         return false;
      }
      return true;
   },

   _overrideBoolXSetting: function(xsetting, show) {
      let values = this.xSetting.get_value('overrides').deep_unpack();
      if(show) {
         if(xsetting in values) {
            let status = values[xsetting]
            if(status != 1) {
               values[xsetting] = GLib.Variant.new('i', 1);
               let returnValue = GLib.Variant.new('a{sv}', values);
               this.xSetting.set_value('overrides', returnValue);
            }
         } else {
            values[xsetting] = GLib.Variant.new('i', 1);
            let returnValue = GLib.Variant.new('a{sv}', values);
            this.xSetting.set_value('overrides', returnValue);
         }
      } else if(xsetting in values) {
         let status = values[xsetting]
         if(status != 0) {
            values[xsetting] = GLib.Variant.new('i', 0); 
            let returnValue = GLib.Variant.new('a{sv}', values);
            this.xSetting.set_value('overrides', returnValue);
         }
      }
   },

   _getEnvGtkModules: function() {
      let envGtk = GLib.getenv('GTK_MODULES');
      if(envGtk)
         return envGtk.split(":");
      return null;
   },

   _setEnvGtkModules: function(envGtkList) {
      let envGtk = "";
      for(let i in envGtkList) {
         if(i == 0) {
            envGtk += envGtkList[i];
         } else if(envGtk.indexOf("unity-gtk-module" ) == -1) {
            envGtk += ":" + envGtkList[i];
         }
      }
      GLib.setenv('GTK_MODULES', envGtk, true);
   },

   _getXSettingGtkModules: function() {
      return this.xSetting.get_strv('enabled-gtk-modules');
   },

   _setXSettingGtkModules: function(envGtkList) {
      this.xSetting.set_strv('enabled-gtk-modules', envGtkList);
   },

   _isCinnamonSessionStart: function() {
      let stringFile = this._readFile(GLib.get_home_dir() + "/.xsession-errors");
      return ((!stringFile) || (stringFile.indexOf("About to start Cinnamon") == stringFile.lastIndexOf("About to start Cinnamon")));
   },

   _readFile: function(path) {
      try {
         let file = Gio.file_new_for_path(path);
         if(file.query_exists(null)) {
            let fstream = file.read(null);
            let dstream = new Gio.DataInputStream({ base_stream: fstream });
            let data = dstream.read_until("", null);
            fstream.close(null);
            return data.toString();
         }
      } catch(e) {
         global.logError("Error:" + e.message);
      }
      return null;
   }
};

/*
 * The IndicatorAppMenuWatcher class implements the IndicatorAppMenu dbus object
 */
function IndicatorAppMenuWatcher() {
   this._init.apply(this, arguments);
}

IndicatorAppMenuWatcher.prototype = {

   _init: function(mode, iconSize) {
      this._mode = mode;
      this._iconSize = iconSize;

      this._registeredWindows = { };
      this._everAcquiredName = false;
      this._ownName = null;

      this._xidLast = 0;
      this._windowsChangedId = 0;
      this._notifyWorkspacesId = 0;
      this._focusWindowId = 0;

      this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBusRegistrar, this);
      this._tracker = Cinnamon.WindowTracker.get_default();
      this._system = new SystemProperties();
      this._isReady = this._initEnviroment();
   },

   // DBus Functions
   RegisterWindowAsync: function(params, invocation) {
      let wind = null;
      let [xid, menubarObjectPath] = params;
      // Return a value Firefox and Thunderbird are waiting for it.
      invocation.return_value(new GLib.Variant('()', []));  
      this._registerWindowXId(xid, wind, menubarObjectPath, invocation.get_sender());
      this._emitWindowRegistered(xid, invocation.get_sender(), menubarObjectPath);
   },

   UnregisterWindowAsync: function(params, invocation) {
      let [xid] = params;
      this._destroyMenu(xid);
   },

   GetMenuForWindowAsync: function(params, invocation) {
      let [xid] = params;
      let retval;
      if(xid in this._registeredWindows)
         retval = GLib.Variant.new('(so)', [this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
      else
         retval = [];
      invocation.return_value(retval);
   },

   GetMenusAsync: function(params, invocation) {
      let result = [];
      for(let xid in this._registeredWindows) {
         result.push([xid, this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
      }
      let retval = GLib.Variant.new('(a(uso))', result);
      invocation.return_value(retval);
   },

   // DBus Signals
   _emitWindowRegistered: function(xid, service, menubarObjectPath) {
      this._dbusImpl.emit_signal('WindowRegistered', GLib.Variant.new('(uso)', [xid, service, menubarObjectPath]));
      global.log("%s RegisterWindow %d %s %s".format(LOG_NAME, xid, service, menubarObjectPath));
   },

   _emitWindowUnregistered: function(xid) {
      this._dbusImpl.emit_signal('WindowUnregistered', GLib.Variant.new('(u)', [xid]));
      global.log("%s UnregisterWindow %d".format(LOG_NAME, xid));
   },

   // Public functions
   watch: function() {
      if((this._isReady)&&(!this._ownName)) {
         this._dbusImpl.export(Gio.DBus.session, WATCHER_OBJECT);
         this._ownName = Gio.DBus.session.own_name(WATCHER_INTERFACE,
                               Gio.BusNameOwnerFlags.NONE,
                               Lang.bind(this, this._acquiredName),
                               Lang.bind(this, this._lostName));

         this._registerAllWindows();
         this._onWindowChanged();

         if(this._windowsChangedId == 0) {
            this._windowsChangedId = this._tracker.connect('tracked-windows-changed',
                                     Lang.bind(this, this._updateWindowsList));
         }
         if(this._notifyWorkspacesId == 0) {
            this._notifyWorkspacesId = global.screen.connect('notify::n-workspaces',
                                       Lang.bind(this, this._registerAllWindows));
         }
         if(this._focusWindowId == 0) {
            this._focusWindowId = global.screen.get_display().connect('notify::focus-window',
                                  Lang.bind(this, this._onWindowChanged));
         }
      }
   },

   canWatch: function() {
      return this._isReady;
   },

   isWatching: function() {
      return ((this._isReady) && (this._ownName));
   },

   getMenuForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows)) {
         let appmenu = this._registeredWindows[xid].appMenu;
         if(appmenu)
            return appmenu.getRoot();
      }
      return null;
   },

   updateMenuForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows)) {
         let appmenu = this._registeredWindows[xid].appMenu;
         if(appmenu)
            appmenu.sendEvent(appmenu.getRootId(), "opened", null, 0);
      }
   },

   getAppForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows))
         return this._registeredWindows[xid].application;
      return null;
   },

   getIconForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows))
         return this._registeredWindows[xid].icon;
      return null;
   },

   setIconSize: function(iconSize) {
      if(this._iconSize != iconSize) {
         this._iconSize = iconSize;
         for(let xid in this._registeredWindows) {
            this._updateIcon(xid);
         }
         if(this._xidLast) {
            this.emit('appmenu-changed', this._registeredWindows[this._xidLast].window);
         }
      }
   },

   // Private functions
   _initEnviroment: function() {
      let isReady = this._system.activeUnityGtkModule(true);
      if(isReady) {
         this._system.activeJAyantanaModule(true);
         this._system.shellShowAppmenu(true);
         this._system.shellShowMenubar(true);
         this._system.activeUnityMenuProxy(true);
         return true;
      }
      return false;
   },

   _acquiredName: function() {
      this._everAcquiredName = true;
      global.log("%s Acquired name %s".format(LOG_NAME, WATCHER_INTERFACE));
   },

   _lostName: function() {
      if(this._everAcquiredName)
         global.log("%s Lost name %s".format(LOG_NAME, WATCHER_INTERFACE));
      else
         global.logWarning("%s Failed to acquire %s".format(LOG_NAME, WATCHER_INTERFACE));
   },

   // Async because we may need to check the presence of a menubar object as well as the creation is async.
   _getMenuClient: function(xid, callback) {
      if(xid in this._registeredWindows) {
         var sender = this._registeredWindows[xid].sender;
         var menubarPath = this._registeredWindows[xid].menubarObjectPath;
         var windowPath = this._registeredWindows[xid].windowObjectPath;
         var appPath = this._registeredWindows[xid].appObjectPath;
         var is_gtk = this._registeredWindows[xid].isGtk;
         if((sender)&&(menubarPath)) {
            if(!is_gtk) {
               this._validateMenu(sender, menubarPath, Lang.bind(this, function(r, name, menubarPath) {
                  if(r) {
                     if(!this._registeredWindows[xid].appMenu) {
                        global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                        callback(xid, new DBusMenu.DBusClient(name, menubarPath));
                     } else {
                        callback(xid, null);
                     }
                  } else {
                     callback(xid, null);
                  }
               }));
            } else {
               if(!this._registeredWindows[xid].appMenu) {
                  global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                  callback(xid, new DBusMenu.DBusClientGtk(sender, menubarPath, windowPath, appPath));
               } else {
                  callback(xid, null);
               }
            }
         } else {
            callback(xid, null);
         }
      } else {
         callback(xid, null);
      }
   },

   _onMenuClientReady: function(xid, client) {
      if(client != null) {
         this._registeredWindows[xid].appMenu = client;
         if(!this._registeredWindows[xid].window) {
            this._registerAllWindows();
         }
         if(this._guessWindowXId(global.display.focus_window) == xid)
            this._onWindowChanged();
         let root = client.getRoot();
         root.connectAndRemoveOnDestroy({
            'childs-empty'   : Lang.bind(this, this._onMenuEmpty, xid),
            'destroy'        : Lang.bind(this, this._onMenuDestroy, xid)
         });
      }
   },

   _onMenuEmpty: function(root, xid) {
      // We don't have alternatives now, so destroy the appmenu.
      this._onMenuDestroy(root, xid);
   },

   _onMenuDestroy: function(root, xid) {
      this._destroyMenu(xid);
   },

   _destroyMenu: function(xid) {
      if((xid) && (xid in this._registeredWindows)) {
         let appMenu = this._registeredWindows[xid].appMenu;
         this._registeredWindows[xid].appMenu = null;
         if(appMenu) {
            appMenu.destroy();
            this._emitWindowUnregistered(xid);
         }
         if(this._xidLast == xid)
            this.emit('appmenu-changed', this._registeredWindows[xid].window);
      }
   },

   _validateMenu: function(bus, path, callback) {
      Gio.DBus.session.call(
         bus, path, "org.freedesktop.DBus.Properties", "Get",
         GLib.Variant.new("(ss)", ["com.canonical.dbusmenu", "Version"]),
         GLib.VariantType.new("(v)"), Gio.DBusCallFlags.NONE, -1, null, function(conn, result) {
            try {
               var val = conn.call_finish(result);
            } catch (e) {
               global.logWarning(LOG_NAME + "Invalid menu. " + e);
               return callback(false);
            }
            var version = val.deep_unpack()[0].deep_unpack();
            // FIXME: what do we implement?
            if(version >= 2) {
               return callback(true, bus, path);
            } else {
               global.logWarning("%s Incompatible dbusmenu version %s".format(LOG_NAME, version));
               return callback(false);
            }
         }, null
      );
   },

   _registerAllWindows: function () {
      for(let index = 0; index < global.screen.n_workspaces; index++) {
         let metaWorkspace = global.screen.get_workspace_by_index(index);
         let winList = metaWorkspace.list_windows();
         // For each window, let's make sure we add it!
         for(let pos in winList) {
            let wind = winList[pos];
            let xid = this._guessWindowXId(wind);
            if(xid) {
               if((xid in this._registeredWindows)&&(this._registeredWindows[xid].fail))
                  continue;
               this._registerWindowXId(xid, wind);
            }
         }
      }
   },

   _updateWindowsList: function () {
      let current = new Array();
      for(let index = 0; index < global.screen.n_workspaces; index++) {
         let metaWorkspace = global.screen.get_workspace_by_index(index);
         let winList = metaWorkspace.list_windows();
         // For each window, let's make sure we add it!
         for(let pos in winList) {
            let wind = winList[pos];
            let xid = this._guessWindowXId(wind);
            if(xid)
               current.push(xid.toString());
         }
      }
      for(let xid in this._registeredWindows) {
         if(current.indexOf(xid) == -1) {
            this._destroyMenu(xid);
            delete this._registeredWindows[xid];
         }
      }
   },

   _updateIcon: function(xid) {
      if(xid in this._registeredWindows) {
         if(this._registeredWindows[xid].icon) {
            this._registeredWindows[xid].icon.destroy();
            this._registeredWindows[xid].icon = null;
         }
         let app = this._registeredWindows[xid].application;
         if(app) {
            let icon = app.create_icon_texture(this._iconSize);
            this._registeredWindows[xid].icon = icon;
         }
      }
   },

   _registerWindowXId: function(xid, wind, menubarPath, senderDbus) {
      let appTracker = null, appmenuPath = null, windowPath = null, appPath = null;
      let isGtkApp = false;

      if(wind) {
         appTracker = this._tracker.get_window_app(wind);
         if((!menubarPath)||(!senderDbus)) {
            if((appTracker)&&(GTK_BLACKLIST.indexOf(appTracker.get_id()) == -1)) {
               menubarPath = wind.get_gtk_menubar_object_path();
               appmenuPath = wind.get_gtk_app_menu_object_path();
               windowPath  = wind.get_gtk_window_object_path();
               appPath     = wind.get_gtk_application_object_path();
               senderDbus  = wind.get_gtk_unique_bus_name();
               isGtkApp    = (senderDbus != null);
            }
         }
      }

      if(xid in this._registeredWindows) {
         // Firefox use the regitrar iface and also the gtk way, but it unsupported.
         // We ask then for the new data and prevent the override of registrar.
         if(!this._registeredWindows[xid].menubarObjectPath)
            this._registeredWindows[xid].menubarObjectPath = menubarPath;
         if(!this._registeredWindows[xid].appmenuObjectPath)
            this._registeredWindows[xid].appmenuObjectPath = appmenuPath;
         if(!this._registeredWindows[xid].windowObjectPath)
            this._registeredWindows[xid].windowObjectPath = windowPath;
         if(!this._registeredWindows[xid].appObjectPath)
            this._registeredWindows[xid].appObjectPath = appPath;
         if(!this._registeredWindows[xid].sender)
            this._registeredWindows[xid].sender = senderDbus;
         if(!this._registeredWindows[xid].application)
            this._registeredWindows[xid].application = appTracker;
         if(!this._registeredWindows[xid].window)
            this._registeredWindows[xid].window = wind;
      } else {
         this._registeredWindows[xid] = {
            window: wind,
            application: appTracker,
            menubarObjectPath: menubarPath,
            appmenuObjectPath: appmenuPath,
            windowObjectPath: windowPath,
            appObjectPath: appPath,
            sender: senderDbus,
            isGtk: isGtkApp,
            icon: null,
            appMenu: null,
            fail: false
         };
      }

      this._tryToGetMenuClient(xid);
   },

   _tryToGetMenuClient: function(xid) {
      this._updateIcon(xid);
      if((xid in this._registeredWindows) && (!this._registeredWindows[xid].appMenu)) {
         if((this._registeredWindows[xid].menubarObjectPath) &&
            (this._registeredWindows[xid].sender)) {
            // FIXME JAyantana is slow, we need to wait for it a little.
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
               this._getMenuClient(xid, Lang.bind(this, this._onMenuClientReady));
            }));
         } else {
            this._registeredWindows[xid].fail = true;
         }
      }  
   },

   _onWindowChanged: function() {
      let xid = this._guessWindowXId(global.display.focus_window);
      if(xid) {
         let registerWin = null;
         if(xid in this._registeredWindows) {
            registerWin = this._registeredWindows[xid];
            if((!registerWin.fail) && 
               ((!registerWin.appMenu)||(!registerWin.window))) {
               this._registerAllWindows();
               registerWin = this._registeredWindows[xid];
            }
            /*if((xid == 41943047)&&(!registerWin.appMenu))
                Main.notify("Registers " + this._registeredWindows[xid].sender + " " + this._registeredWindows[xid].menubarObjectPath);
            else if(xid == 41943047)
                Main.notify("Register " + this._registeredWindows[xid].sender + " " + this._registeredWindows[xid].menubarObjectPath);*/
         } else {
            this._registerAllWindows();
            if(xid in this._registeredWindows)
               registerWin = this._registeredWindows[xid];
         }
         if(registerWin) {
            this.emit('appmenu-changed', registerWin.window);
            this._xidLast = xid;
         }
      } else {
         this.emit('appmenu-changed', null);
         this._xidLast = null;
      }
   },

   // NOTE: we prefer to use the window's XID but this is not stored
   // anywhere but in the window's description being [XID (%10s window title)].
   // And I'm not sure I want to rely on that being the case always.
   // (mutter/src/core/window-props.c)
   //
   // If we use the windows' title, `xprop` grabs the "least-focussed" window
   // (bottom of stack I suppose).
   //
   // Can match winow.get_startup_id() to WM_WINDOW_ROLE(STRING)
   // If they're not equal, then try the XID?
   _guessWindowXId: function (wind) {
      if(!wind)
         return null;

      let id = null;
      // If window title has non-utf8 characters, get_description() complains
      // "Failed to convert UTF-8 string to JS string: Invalid byte sequence in conversion input",
      // event though get_title() works.
      if(wind.get_xwindow)
         return wind.get_xwindow();
      try {
         id = wind.get_description().match(/0x[0-9a-f]+/);
         if(id) {
            return parseInt(id[0], 16);
         }
      } catch(err) {
      }

      // Use xwininfo, take first child.
      let act = wind.get_compositor_private();
      if(act) {
         id = GLib.spawn_command_line_sync('xwininfo -children -id 0x%x'.format(act['x-window']));
         if(id[0]) {
            let str = id[1].toString();

            // The X ID of the window is the one preceding the target window's title.
            // This is to handle cases where the window has no frame and so
            // act['x-window'] is actually the X ID we want, not the child.
            let regexp = new RegExp('(0x[0-9a-f]+) +"%s"'.format(wind.title));
            id = str.match(regexp);
            if(id) {
               return parseInt(id[1], 16);
            }

            // Otherwise, just grab the child and hope for the best
            id = str.split(/child(?:ren)?:/)[1].match(/0x[0-9a-f]+/);
            if(id) {
               return parseInt(id[0], 16);
            }
         }
      }
      // Debugging for when people find bugs..
      global.logError("%s Could not find XID for window with title %s".format(LOG_NAME, wind.title));
      return null;
   },

   destroy: function() {
      if(this._registeredWindows) {
         // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
         // which results in our unholy debounce hack (see extension.js)
         Gio.DBus.session.unown_name(this._ownName);
         this._dbusImpl.unexport();
         if(this._focusWindowId > 0) {
            global.screen.get_display().disconnect(this._focusWindowId);
            this._focusWindowId = 0;
         }
         if(this._notifyWorkspacesId > 0) {
            global.screen.disconnect(this._notifyWorkspacesId);
            this._notifyWorkspacesId = 0;
         }
         if(this._windowsChangedId > 0) {
            this._tracker.disconnect(this._windowsChangedId);
            this._windowsChangedId = 0;
         }
         for(let xid in this._registeredWindows) {
            let register = this._registeredWindows[xid];
            if(register.icon)
               register.icon.destroy();
            this._destroyMenu(xid);
         }
         this._registeredWindows = null;
         this._system.shellShowAppmenu(false);
         this._system.shellShowMenubar(false);
         this._system.activeUnityMenuProxy(false);
         this._system.activeJAyantanaModule(false);
         // FIXME When we can call system.activeUnityGtkModule(false)?
         // Is possible that we need to add an option to the settings
         // to be more easy to the user uninstall the applet
      }
   }
};
Signals.addSignalMethods(IndicatorAppMenuWatcher.prototype);
