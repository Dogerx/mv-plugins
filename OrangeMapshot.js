/*=============================================================================
 * Orange - Mapshot
 * By Hudell - www.hudell.com
 * OrangeMapshot.js
 * Version: 1.0.1
 * Free for commercial and non commercial use.
 *=============================================================================*/
/*:
 * @plugindesc This plugin will save a picture of the entire map on a Mapshots folder when you press a key. <OrangeMapshot>
 * @author Hudell
 *
 * @param useMapName
 * @desc if true, the filename will be the name of the map. If false it will be the number.
 * @default true
 *
 * @param separateLayers
 * @desc if true, the plugin will create two separate images with the lower and upper layer
 * @default false
 *
 * @param keyCode
 * @desc code of the key that will be used (44 = printscreen). http://link.hudell.com/js-keys
 * @default 44
 *
 * @help
 * Check keycodes at  http://link.hudell.com/js-keys
 */
var Imported = Imported || {};

var OrangeMapshot = OrangeMapshot || {};

(function($) {
  "use strict";

  var parameters = $plugins.filter(function(plugin) {
    return plugin.description.indexOf('<OrangeMapshot>') >= 0;
  });
  if (parameters.length === 0) {
    throw new Error("Couldn't find OrangeMapshot parameters.");
  }
  $.Parameters = parameters[0].parameters;
  $.Param = {};
  $.Param.useMapName = $.Parameters.useMapName !== "false";
  $.Param.separateLayers = $.Parameters.separateLayers === "true";

  $.Param.keyCode = Number($.Parameters.keyCode || 44);

  $.baseFileName = function() {
    var mapName = ($gameMap._mapId).padZero(3);
    if ($.Param.useMapName) {
      mapName = $dataMapInfos[$gameMap._mapId].name;
    } else {
      mapName = 'Map' + mapName;
    }

    return mapName;
  };

  $.getMapshot = function() {
    var lowerBitmap, upperBitmap;

    lowerBitmap = new Bitmap($dataMap.width * $gameMap.tileWidth(), $dataMap.height * $gameMap.tileHeight());
    if ($.Param.separateLayers) {
      upperBitmap = new Bitmap($dataMap.width * $gameMap.tileWidth(), $dataMap.height * $gameMap.tileHeight());
    } else {
      upperBitmap = lowerBitmap;
    }

    SceneManager._scene._spriteset._tilemap._paintEverything(lowerBitmap, upperBitmap);

    return [lowerBitmap, upperBitmap];
  };

  Tilemap.prototype._paintEverything = function(lowerBitmap, upperBitmap) {
    var tileCols = $dataMap.width;
    var tileRows = $dataMap.height;

    for (var y = 0; y < tileRows; y++) {
      for (var x = 0; x < tileCols; x++) {
        this._paintTilesOnBitmap(lowerBitmap, upperBitmap, x, y);
      }
    }
  };

  Tilemap.prototype._paintTilesOnBitmap = function(lowerBitmap, upperBitmap, x, y) {
    var tableEdgeVirtualId = 10000;
    var mx = x;
    var my = y;
    var dx = (mx * this._tileWidth);
    var dy = (my * this._tileHeight);
    var lx = dx / this._tileWidth;
    var ly = dy / this._tileHeight;
    var tileId0 = this._readMapData(mx, my, 0);
    var tileId1 = this._readMapData(mx, my, 1);
    var tileId2 = this._readMapData(mx, my, 2);
    var tileId3 = this._readMapData(mx, my, 3);
    var shadowBits = this._readMapData(mx, my, 4);
    var upperTileId1 = this._readMapData(mx, my - 1, 1);
    var lowerTiles = [];
    var upperTiles = [];

    if (this._isHigherTile(tileId0)) {
      upperTiles.push(tileId0);
    } else {
      lowerTiles.push(tileId0);
    }
    if (this._isHigherTile(tileId1)) {
      upperTiles.push(tileId1);
    } else {
      lowerTiles.push(tileId1);
    }

    lowerTiles.push(-shadowBits);

    if (this._isTableTile(upperTileId1) && !this._isTableTile(tileId1)) {
      if (!Tilemap.isShadowingTile(tileId0)) {
        lowerTiles.push(tableEdgeVirtualId + upperTileId1);
      }
    }

    if (this._isOverpassPosition(mx, my)) {
      upperTiles.push(tileId2);
      upperTiles.push(tileId3);
    } else {
      if (this._isHigherTile(tileId2)) {
        upperTiles.push(tileId2);
      } else {
        lowerTiles.push(tileId2);
      }
      if (this._isHigherTile(tileId3)) {
        upperTiles.push(tileId3);
      } else {
        lowerTiles.push(tileId3);
      }
    }

    lowerBitmap.clearRect(dx, dy, this._tileWidth, this._tileHeight);
    upperBitmap.clearRect(dx, dy, this._tileWidth, this._tileHeight);

    for (var i = 0; i < lowerTiles.length; i++) {
      var lowerTileId = lowerTiles[i];
      if (lowerTileId < 0) {
        this._drawShadow(lowerBitmap, shadowBits, dx, dy);
      } else if (lowerTileId >= tableEdgeVirtualId) {
        this._drawTableEdge(lowerBitmap, upperTileId1, dx, dy);
      } else {
        this._drawTile(lowerBitmap, lowerTileId, dx, dy);
      }
    }

    for (var j = 0; j < upperTiles.length; j++) {
      this._drawTile(upperBitmap, upperTiles[j], dx, dy);
    }
  };

  $.saveMapshot = function() {
    if (!Utils.isNwjs()) return;

    var fs = require('fs');
    var path = './Mapshots';

    try {
      fs.mkdir(path, function() {
        var fileName = path + '/' + $.baseFileName();
        var names = [fileName + '.png'];
        var maxFiles = 1;

        if ($.Param.separateLayers) {
          maxFiles = 2;
          names = [
            fileName + '_lower.png',
            fileName + '_upper.png'
          ];
        } 

        var snaps = $.getMapshot();

        for (var i = 0; i < maxFiles; i++) {
          var urlData = snaps[i].canvas.toDataURL();
          var base64Data = urlData.replace(/^data:image\/png;base64,/, "");

          fs.writeFile(names[i], base64Data, 'base64', function(error) {
            if (error !== undefined && error !== null) {
              console.error('An error occured while saving the mapshot', error);
            }
          });
        }
      });
    } catch (error) {
      if (error !== undefined && error !== null) {
        console.error('An error occured while saving the mapshot:', error);
      }
    }
  };

  var oldInput_onKeyUp = Input._onKeyUp;
  Input._onKeyUp = function(event) {
    oldInput_onKeyUp.call(this, event);

    if (event.keyCode == $.Param.keyCode) {
      if (SceneManager._scene instanceof Scene_Map) {
        $.saveMapshot();
      }
    }
  };
})(OrangeMapshot);

Imported["OrangeMapshot"] = true;