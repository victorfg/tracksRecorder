/** Capes base disponibles.
 * Fonts: [ICGC](https://www.icgc.cat), [IGN IDE](https://www.ign.es/web/ign/portal/ide-area-nodo-ide-ign)
 */

export type BasemapId = string;

export type Basemap = {
  id: BasemapId;
  name: string;
  url: string;
  attribution: string;
  /** true si el servidor usa TMS (eix Y invertit) */
  tms?: boolean;
  /** Nivell de zoom màxim amb tiles reals (ICGC suporta 20, Leaflet per defecte 18) */
  maxZoom?: number;
};

const ICGC_ATTRIBUTION =
  '© <a href="https://www.icgc.cat" target="_blank" rel="noopener">ICGC</a> · Catalunya ©ICGC CC-BY · Resta món ©OpenMapTiles ©OpenStreetMap';

const IGN_ATTRIBUTION =
  '© <a href="https://www.ign.es" target="_blank" rel="noopener">Instituto Geográfico Nacional</a>';

const ICGC_BASE = "https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts";

const IGN_TMS = "https://tms-mapa-raster.ign.es/1.0.0/mapa-raster";

export const BASEMAPS: Basemap[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: "icgc-topografic",
    name: "ICGC Topogràfic",
    url: `${ICGC_BASE}/topografic/MON3857NW/{z}/{x}/{y}.png`,
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  {
    id: "icgc-topografic-gris",
    name: "ICGC Topogràfic Gris",
    url: `${ICGC_BASE}/topografic-gris/MON3857NW/{z}/{x}/{y}.png`,
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  {
    id: "icgc-orto",
    name: "ICGC Orto",
    url: `${ICGC_BASE}/orto/MON3857NW/{z}/{x}/{y}.png`,
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  {
    id: "icgc-orto-gris",
    name: "ICGC Orto Gris",
    url: `${ICGC_BASE}/orto-gris/MON3857NW/{z}/{x}/{y}.png`,
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  {
    id: "icgc-orto-hibrida",
    name: "ICGC Orto Híbrida",
    url: `${ICGC_BASE}/orto-hibrida/MON3857NW/{z}/{x}/{y}.png`,
    attribution: ICGC_ATTRIBUTION,
    maxZoom: 20,
  },
  // IGN España (TMS, eix Y invertit)
  {
    id: "ign-raster",
    name: "IGN Cartografia Raster",
    url: `${IGN_TMS}/{z}/{x}/{y}.jpeg`,
    attribution: IGN_ATTRIBUTION,
    tms: true,
  },
  {
    id: "ign-pnoa-ma",
    name: "IGN PNOA Màx. Actualitat",
    url: "https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg",
    attribution: IGN_ATTRIBUTION,
    tms: true,
  },
];

const STORAGE_KEY = "tracksrecorder-basemap";

export function getStoredBasemapId(): BasemapId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && BASEMAPS.some((b) => b.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return "icgc-topografic-gris";
}

export function storeBasemapId(id: BasemapId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
