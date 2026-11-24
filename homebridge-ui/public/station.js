'use strict';
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./stations'));
  else root.WeatherStation = factory(root.DwdStations);
})(globalThis, stations => {
  function distance(a, b) {
    const rad = d => d * Math.PI / 180;
    const x = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
  }
  function select(config) {
    const list = stations.filter(s => !config.dwdStation || s.id === config.dwdStation)
      .map(s => ({...s, distance: distance(config, s)})).sort((a,b) => a.distance - b.distance);
    const station = list[0];
    if (!station) throw new Error('DWD-Station nicht im mitgelieferten POI-Stationskatalog.');
    if (station.distance > (config.dwdMaxDistance ?? 100)) throw new Error('Keine DWD-Station innerhalb der maximalen Entfernung.');
    return station;
  }
  return {distance, select};
});
