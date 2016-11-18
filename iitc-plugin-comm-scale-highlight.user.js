// ==UserScript==
// @id             iitc-plugin-comm-scale-highlight@phoudoin
// @name           IITC plugin: links & fields scale in COMM
// @category       Tweaks
// @version        0.1.1.20161021.000001
// @namespace      https://github.com/phoudoin/iitc-scale-highlight
// @updateURL      https://github.com/phoudoin/iitc_plugins/raw/master/iitc-plugin-comm-scale-highlight.user.js
// @downloadURL    https://github.com/phoudoin/iitc_plugins/raw/master/iitc-plugin-comm-scale-highlight.user.js
// @description	   [phoudoin-2016-10-21] display link length and field size in log according a colors scale.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'jonatkins';
plugin_info.dateTimeVersion = '20151113.000001';
plugin_info.pluginId = 'comm-scale-highlight';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////


// use own namespace for plugin
window.plugin.commScaleHighlight = function() {};

window.plugin.commScaleHighlight.formatDistance = function(dist) {
  var result = '';
  if (dist > 100000) {
    result += '<span style="color: DarkViolet;">';
    result += Math.round(dist/1000)+' km';
    result += '</span>';
  } else if (dist > 10000) {
    result += '<span style="color: red;">';
    result += Math.round(dist/1000)+' km';
    result += '</span>';
  } else if (dist > 1000) {
    result += '<span style="color: pink;">';
    result += Math.round(dist/100)/10+' km';
    result += '</span>';
  } else {
    result += Math.round(dist)+' m';
  }

  return result;
}

window.plugin.commScaleHighlight.formatMindUnit = function(mu, unit) {
  var result = '';
  var amu = Math.abs(mu);
  var span = null;
  if (amu > 100000) {
    span = '<span style="color: DarkViolet;">';
  } else if (amu > 50000) {
    span = '<span style="color: red;">';
  } else if (amu > 1000) {
    span = '<span style="color: pink;">';
  }

  if (span) result += span;
 
  result += (mu > 0) ? "+" + mu : mu;
  result += unit;

  if (span) result += "</span>";

  return result;
}

window.plugin.commScaleHighlight.formatVirus = function(new_portal_team) {
  var result;
  if (new_portal_team == 'RESISTANCE') {
    result = '<span style="color: ' + COLORS[TEAM_RES] + ';"> ADA !!!';
  } else {
    result = '<span style="color: ' + COLORS[TEAM_ENL] + ';"> JARVIS !!!';
  }
  result += '</span>';
  return result;
}

window.plugin.commScaleHighlight.setup  = function() {
  window.addHook('publicChatDataAvailable', function(data) {
      $.each(data.raw.result, function(i, result) {
          var plext = result[2].plext;
          var guid = result[0];

          if (plext.markup[1][1].plain==' linked ' || 
            plext.markup[1][1].plain==' destroyed the Link ') {

            // Highlight link length

            var lat1 = plext.markup[2][1].latE6/1e6;
            var lng1 = plext.markup[2][1].lngE6/1e6;
            var lat2 = plext.markup[4][1].latE6/1e6;
            var lng2 = plext.markup[4][1].lngE6/1e6;
            var dist = (new L.latLng(lat1,lng1).distanceTo(new L.latLng(lat2,lng2)));
            var $tr = $(chat._public.data[guid][2]);
            var $msg = $tr.find('td:last');
            var msgToAppend = ' ('+window.plugin.commScaleHighlight.formatDistance(dist)+')';
            if ($msg.html().indexOf(msgToAppend) === -1 ) {
              $msg.append(msgToAppend);
              chat._public.data[guid][2] = $tr.prop('outerHTML');
            }

          } else if (plext.markup[1][1].plain==' created a Control Field @' || 
            plext.markup[1][1].plain==' destroyed a Control Field @') {

            // Highlight field size

            // console.log(plext);
            var mu = Number(plext.markup[3][1].plain + plext.markup[4][1].plain);
            var unit = plext.markup[5][1].plain;
            // console.log("Control Field: " + mu + " " + unit);
            var highlight = ' ('+window.plugin.commScaleHighlight.formatMindUnit(mu, unit)+')';
            // console.log("highlight:");
            // console.log(highlight);
            var $tr = $(chat._public.data[guid][2]);
            var $msg = $tr.find('td:last');
            // console.log("$msg"); console.log($msg);
            var toReplace = plext.markup[3][1].plain + plext.markup[4][1].plain + plext.markup[5][1].plain;
            // console.log(toReplace);

            if ($msg.html().indexOf(highlight) === -1) {
              content = $msg.html()
              // console.log(content);
              content = content.replace(toReplace, '');
              // console.log(content);
              $msg.html(content);
              $msg.append(highlight);
              // console.log("$msg.html():" + $msg.html());
              chat._public.data[guid][2] = $tr.prop('outerHTML');
            }

          } else if (plext.markup[1][1].plain==' destroyed a Resonator on ' || 
                    (plext.plextType == 'SYSTEM_NARROWCAST' && 
                     plext.markup.length == 4 && 
                     plext.markup[0][1].plain == 'Your Portal ' &&
                     plext.markup[2][1].plain == ' neutralized by ' &&
                     plext.markup[3][1].team == PLAYER.team)) {

            // Highlight JARVIS and ADA virus
            // Two possibles cases:
            // - applied on same faction portals (then, player destroying resonators is same team as the portal or PLAYER alignement)
            // - applied on opposite faction portals (then, we have up to 8 notifications of resonator destroyed for same portal at same timestamp
            //   as all resonators are destroyed at once, instantly)
    
            // console.log(plext);
            
            var player_team;
            var portal_team;
            var virus_detected = false;
            if (plext.plextType == 'SYSTEM_NARROWCAST') {
              // detect virus when your portal is destroyed by same faction than you...
              player_team = plext.markup[3][1].team;
              portal_team = plext.markup[1][1].team;
              virus_detected = player_team == PLAYER.team;
            } else {
              // detect on resonator destruction context
              player_team = plext.markup[0][1].team;
              portal_team = plext.markup[2][1].team;

              if (player_team == portal_team) {
                // virus detected when a player is destroying a portal of his own faction...
                virus_detected = true;
              } else {
                // TODO: try to detect virus used to take down adverse portal, by comparing similar destruction log at same timestamp
              }
            }
           
            if (virus_detected) {
              console.log('VIRUS DETECTED, by ' + player_team + ' faction, portal is now ' + portal_team);
              // Portal tilted by faction owning it
              var highlight = ' ('+window.plugin.commScaleHighlight.formatVirus(portal_team)+')';
              // console.log("highlight:");
              // console.log(highlight);
              var $tr = $(chat._public.data[guid][2]);
              var $msg = $tr.find('td:last');
              if ($msg.html().indexOf(highlight) === -1 ) {
                $msg.append(highlight);
                chat._public.data[guid][2] = $tr.prop('outerHTML');
              }
            }          

          } else {
            // console.log("plext:");
            // console.log(plext);
          }
      });
  });
};

var setup =  window.plugin.commScaleHighlight.setup;

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


