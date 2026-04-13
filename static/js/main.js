// ============================================================
//  Litoral Smart CRM — main.js
//  Espumados del Litoral · Barranquilla 2026
// ============================================================

// ═══════════════════════════════════════════════════════════
//  1. MAPAS
// ═══════════════════════════════════════════════════════════
let mapaHome = null;
let mapaFull = null;
let mapaRuta = null;

const _tiles = (dark) => dark
  ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' })
  : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });

let tileHome = null;
let tileFull = null;
let tileRuta = null;

function initMapaHome() {
  if (mapaHome || !document.getElementById('mapa-litoral')) return;
  mapaHome = L.map('mapa-litoral').setView([10.9685, -74.7813], 13);
  tileHome = _tiles(true);
  tileHome.addTo(mapaHome);
  cargarPuntosEnMapa(mapaHome);
}

function initMapaFull() {
  if (mapaFull || !document.getElementById('mapa-litoral-full')) return;
  mapaFull = L.map('mapa-litoral-full').setView([10.9685, -74.7813], 13);
  tileFull = _tiles(true);
  tileFull.addTo(mapaFull);
  cargarPuntosEnMapa(mapaFull);
}

function initMapaRuta() {
  if (mapaRuta || !document.getElementById('mapa-ruta')) return;
  mapaRuta = L.map('mapa-ruta').setView([10.9685, -74.7813], 13);
  tileRuta = _tiles(true);
  tileRuta.addTo(mapaRuta);
  renderizarMapaRuta();
}

function actualizarCapaMapa(tema) {
  const isDark = tema === 'dark';
  [
    [mapaHome, () => tileHome, (t) => { tileHome = t; }],
    [mapaFull, () => tileFull, (t) => { tileFull = t; }],
    [mapaRuta, () => tileRuta, (t) => { tileRuta = t; }],
  ].forEach(([mapa, getT, setT]) => {
    if (!mapa) return;
    try { mapa.removeLayer(getT()); } catch (e) {}
    const newTile = _tiles(isDark);
    newTile.addTo(mapa);
    setT(newTile);
  });
}

function estadoColor(estado) {
  return {
    Prospecto:   '#F59E0B',
    Contactado:  '#3B82F6',
    Interesado:  '#F05A1A',
    Cotización:  '#A855F7',
    Negociación: '#EC4899',
    Cliente:     '#22C55E',
  }[estado] || '#A0A8C0';
}

function stClass(e) {
  return {
    Prospecto:   's-p',
    Contactado:  's-c',
    Interesado:  's-i',
    Cotización:  's-q',
    Negociación: 's-n',
    Cliente:     's-k',
  }[e] || 's-p';
}

async function cargarPuntosEnMapa(mapa) {
  try {
    const res     = await fetch('/obtener_visitas');
    const visitas = await res.json();

    visitas.forEach(v => {
      if (v.latitud && v.longitud) {
        const color = estadoColor(v.estado);
        L.circleMarker([v.latitud, v.longitud], {
          radius: 9, fillColor: color, color: '#FFF', weight: 2, fillOpacity: .85,
        }).addTo(mapa).bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${v.cliente}</div>
            <div style="font-size:11px;color:#666;margin-bottom:4px">${v.producto || '—'}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${color}22;color:${color}">${v.estado}</div>
          </div>`);
      }
    });

    const tbody = document.getElementById('tabla-visitas');
    if (tbody) {
      tbody.innerHTML = visitas.length
        ? visitas.map(v => `
          <tr>
            <td style="font-size:11px;color:var(--text2)">${v.fecha}</td>
            <td><b>${v.cliente}</b></td>
            <td style="font-size:11px">${v.producto || '—'}</td>
            <td><span class="st ${stClass(v.estado)}">${v.estado}</span></td>
            <td>${v.latitud
              ? `<a href="https://www.google.com/maps?q=${v.latitud},${v.longitud}" target="_blank" style="color:var(--info);text-decoration:none;font-size:12px">Ver mapa</a>`
              : '<span style="color:var(--text3);font-size:11px">Sin GPS</span>'
            }</td>
          </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text2)">Sin visitas registradas</td></tr>';
    }
  } catch (e) {
    console.error('Error cargando mapa:', e);
  }
}


// ═══════════════════════════════════════════════════════════
//  2. RUTAS DEL DÍA
// ═══════════════════════════════════════════════════════════
let rutaClientes = [];
const RUTA_MAX   = 5;

const TIPO_CONFIG = {
  hotel:    { icon: 'hotel',          colorClass: 'tipo-hotel',    badgeClass: 'badge-hotel'    },
  hospital: { icon: 'local_hospital', colorClass: 'tipo-hospital', badgeClass: 'badge-hospital' },
  oficina:  { icon: 'business',       colorClass: 'tipo-oficina',  badgeClass: 'badge-oficina'  },
  otros:    { icon: 'storefront',     colorClass: 'tipo-otros',    badgeClass: 'badge-otros'    },
};

function normalizarDir(dir) {
  return dir
    .replace(/\bcll\b/gi,  'Calle')
    .replace(/\bcl\b/gi,   'Calle')
    .replace(/\bcra\b/gi,  'Carrera')
    .replace(/\bcr\b/gi,   'Carrera')
    .replace(/\bkra\b/gi,  'Carrera')
    .replace(/\bkr\b/gi,   'Carrera')
    .replace(/\btv\b/gi,   'Transversal')
    .replace(/\bav\b/gi,   'Avenida')
    .replace(/\bdiag\b/gi, 'Diagonal')
    .replace(/#/g,         'No. ')
    .trim();
}

async function geocodificarDireccion(cliente) {
  try {
    const dirNorm = normalizarDir(cliente.dir);
    const q       = encodeURIComponent(`${dirNorm}, Barranquilla, Colombia`);
    const res     = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=co`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await res.json();
    if (data.length) {
      cliente.coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      renderizarMapaRuta();
      toast('Dirección ubicada en el mapa');
    } else {
      toast('Dirección no encontrada, verifica el formato');
    }
  } catch (e) {
    console.warn('Geocodificación falló:', e);
    toast('Error al buscar la dirección');
  }
}

function agregarARuta() {
  const negocio   = document.getElementById('ar-negocio')?.value.trim();
  const encargado = document.getElementById('ar-encargado')?.value.trim();
  const tel       = document.getElementById('ar-tel')?.value.trim();
  const email     = document.getElementById('ar-email')?.value.trim();
  const tipo      = document.getElementById('ar-tipo')?.value;
  const dir       = document.getElementById('ar-dir')?.value.trim();

  if (!negocio) { toast('Ingresa el nombre del negocio'); return; }
  if (rutaClientes.length >= RUTA_MAX) { toast(`Máximo ${RUTA_MAX} clientes por ruta`); return; }

  rutaClientes.push({ id: Date.now(), negocio, encargado, tel, email, tipo, dir, coords: null });

  ['ar-negocio','ar-encargado','ar-tel','ar-email','ar-dir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  cerrarModal('m-add-ruta');
  if (dir) geocodificarDireccion(rutaClientes[rutaClientes.length - 1]);
  renderRuta();
  toast('Cliente agregado a la ruta');
}

function renderRuta() {
  const lista    = document.getElementById('lista-ruta');
  const badge    = document.getElementById('ruta-badge');
  const contador = document.getElementById('ruta-contador');
  const btnMaps  = document.getElementById('btn-abrir-maps');

  if (badge)    badge.textContent     = rutaClientes.length;
  if (contador) contador.textContent  = `${rutaClientes.length} / ${RUTA_MAX} clientes en ruta`;
  if (btnMaps)  btnMaps.style.display = rutaClientes.length > 0 ? '' : 'none';

  if (!lista) return;

  if (!rutaClientes.length) {
    lista.innerHTML = `
      <div class="ruta-empty">
        <span class="material-icons" style="font-size:36px;color:var(--text3);display:block;margin-bottom:8px">route</span>
        Agrega hasta 5 clientes para planificar tu ruta de hoy
      </div>`;
    actualizarPreviewDash();
    return;
  }

  const colores = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];

  lista.innerHTML = rutaClientes.map((c, i) => {
    const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.otros;
    return `
    <div class="ruta-card" id="ruta-card-${c.id}">
      <div class="ruta-card-numero" style="background:${colores[i % colores.length]}">${i + 1}</div>
      <span class="material-icons ruta-card-ico" style="font-size:22px;color:var(--text2)">${cfg.icon}</span>
      <div class="ruta-card-info">
        <div class="ruta-card-nombre">${c.negocio}</div>
        ${c.encargado ? `<div class="ruta-card-encargado">${c.encargado}</div>` : ''}
        <div class="ruta-card-contacto">
          ${c.tel   ? `<span class="ruta-card-tel">${c.tel}</span>`   : ''}
          ${c.email ? `<span class="ruta-card-email">${c.email}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px">
          <span class="badge-o" style="font-size:9px">${c.tipo}</span>
          ${c.dir ? `<span style="font-size:10px;color:var(--text3)">${c.dir.substring(0,30)}${c.dir.length > 30 ? '...' : ''}</span>` : ''}
          ${c.coords ? '<span style="font-size:10px;color:var(--ok);font-weight:700">Geocodificado</span>' : ''}
        </div>
        <div class="ruta-card-actions">
          ${c.tel ? `<button class="btn bp bs" onclick="llamarCliente('${c.tel}')"><span class="material-icons" style="font-size:12px">call</span></button>` : ''}
          ${c.tel ? `<button class="btn bg2 bs" onclick="waRuta('${c.negocio}','${c.tel}')"><span class="material-icons" style="font-size:12px">chat</span></button>` : ''}
        </div>
      </div>
      <button class="ruta-card-remove" onclick="eliminarDeRuta(${c.id})" title="Quitar">
        <span class="material-icons" style="font-size:16px">close</span>
      </button>
    </div>`;
  }).join('');

  actualizarPreviewDash();
  renderizarMapaRuta();
}

function eliminarDeRuta(id) {
  rutaClientes = rutaClientes.filter(c => c.id !== id);
  renderRuta();
  toast('Cliente quitado de la ruta');
}

function llamarCliente(tel) { window.location.href = `tel:${tel}`; }

function waRuta(nombre, tel) {
  const msg = encodeURIComponent(
    `Hola, le escribe *Cándida Caballero* de *Espumados del Litoral*.\n` +
    `Estoy en camino para visitarles. ¿Sigue disponible la reunión con *${nombre}*?`
  );
  window.open(`https://wa.me/57${tel.replace(/\D/g, '')}?text=${msg}`, '_blank');
}

function optimizarRuta() {
  if (rutaClientes.length < 2) { toast('Agrega al menos 2 clientes para optimizar'); return; }
  if (!navigator.geolocation)  { toast('GPS no disponible'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const origen    = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    const conCoords = rutaClientes.filter(c => c.coords);
    if (conCoords.length < 2) { toast('Agrega direcciones para optimizar'); return; }
    conCoords.sort((a, b) =>
      distancia(origen.lat, origen.lon, a.coords.lat, a.coords.lon) -
      distancia(origen.lat, origen.lon, b.coords.lat, b.coords.lon)
    );
    rutaClientes = [...conCoords, ...rutaClientes.filter(c => !c.coords)];
    renderRuta();
    toast('Ruta optimizada: del más cercano al más lejano');
  }, () => toast('Activa el GPS para optimizar'));
}

function distancia(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let rutaPolyline = null;
let rutaMarkers  = [];

function renderizarMapaRuta() {
  if (!mapaRuta) return;
  rutaMarkers.forEach(m => mapaRuta.removeLayer(m));
  rutaMarkers = [];
  if (rutaPolyline) { mapaRuta.removeLayer(rutaPolyline); rutaPolyline = null; }

  const colores         = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];
  const puntosConCoords = [];

  rutaClientes.forEach((c, i) => {
    if (!c.coords) return;
    const color  = colores[i % colores.length];
    const marker = L.circleMarker([c.coords.lat, c.coords.lon], {
      radius: 12, fillColor: color, color: '#fff', weight: 2, fillOpacity: .9,
    }).addTo(mapaRuta).bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:140px">
        <div style="font-size:10px;font-weight:800;color:${color}">PARADA ${i + 1}</div>
        <div style="font-weight:700;font-size:13px;margin:3px 0">${c.negocio}</div>
        ${c.encargado ? `<div style="font-size:11px;color:#666">${c.encargado}</div>` : ''}
        ${c.tel       ? `<div style="font-size:11px;color:#3B82F6">${c.tel}</div>`   : ''}
      </div>`);
    rutaMarkers.push(marker);
    puntosConCoords.push([c.coords.lat, c.coords.lon]);
  });

  if (puntosConCoords.length > 1) {
    rutaPolyline = L.polyline(puntosConCoords, { color:'#F05A1A', weight:3, opacity:.7, dashArray:'8 4' }).addTo(mapaRuta);
    mapaRuta.fitBounds(rutaPolyline.getBounds(), { padding:[20,20] });
  } else if (puntosConCoords.length === 1) {
    mapaRuta.setView(puntosConCoords[0], 15);
  }
}

function abrirEnGoogleMaps() {
  if (!rutaClientes.length) return;
  const conCoords = rutaClientes.filter(c => c.coords);

  if (conCoords.length < 1) {
    const dirs = rutaClientes.map(c =>
      encodeURIComponent(normalizarDir(c.dir || c.negocio) + ', Barranquilla, Colombia')
    );
    window.open(`https://www.google.com/maps/dir/${dirs.join('/')}`, '_blank');
    return;
  }

  const destinos  = conCoords.map(c => `${c.coords.lat},${c.coords.lon}`);
  const dest      = destinos.pop();
  const waypoints = destinos.join('|');
  const url = waypoints
    ? `https://www.google.com/maps/dir/current+location/${waypoints}/${dest}`
    : `https://www.google.com/maps/dir/current+location/${dest}`;
  window.open(url, '_blank');
}

async function buscarCercanos() {
  if (!navigator.geolocation) { toast('GPS no disponible'); return; }
  toast('Buscando negocios cercanos...');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const query = `[out:json][timeout:10];(
      node["tourism"="hotel"](around:500,${lat},${lon});
      node["amenity"="hospital"](around:500,${lat},${lon});
      node["amenity"="clinic"](around:500,${lat},${lon});
      node["office"](around:500,${lat},${lon});
    );out body 15;`;
    try {
      const r    = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:query });
      const data = await r.json();
      renderCercanos(data.elements, lat, lon);
    } catch (e) {
      document.getElementById('lista-cercanos').innerHTML =
        '<div style="font-size:12px;color:var(--text3);padding:10px">No se pudo conectar. Verifica la conexión.</div>';
    }
  }, () => toast('Activa el GPS'));
}

function renderCercanos(elementos, latO, lonO) {
  const lista   = document.getElementById('lista-cercanos');
  const iconMap = { hotel:'hotel', hospital:'local_hospital', clinic:'local_hospital', office:'business' };
  if (!elementos?.length) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px">No se encontraron negocios en 500m</div>';
    return;
  }
  lista.innerHTML = elementos.slice(0,8).map(el => {
    const nombre = el.tags?.name || 'Negocio sin nombre';
    const tipo   = el.tags?.tourism || el.tags?.amenity || el.tags?.office || 'negocio';
    const icon   = iconMap[tipo] || 'storefront';
    const dist   = Math.round(distancia(latO, lonO, el.lat, el.lon) * 1000);
    return `
    <div class="cercano-chip" onclick="agregarCercanoARuta('${nombre}','${tipo}','${el.lat}','${el.lon}')">
      <span class="material-icons" style="font-size:20px;color:var(--o)">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombre}</div>
        <div style="font-size:10px;color:var(--text2)">${tipo}</div>
      </div>
      <span class="cercano-dist">${dist}m</span>
    </div>`;
  }).join('');
}

function agregarCercanoARuta(nombre, tipo, lat, lon) {
  if (rutaClientes.length >= RUTA_MAX) { toast('Ruta llena (máx 5)'); return; }
  const tipoMap = { hotel:'hotel', hospital:'hospital', clinic:'hospital', office:'oficina' };
  rutaClientes.push({
    id: Date.now(), negocio: nombre, encargado:'', tel:'', email:'',
    tipo: tipoMap[tipo] || 'otros', dir:'',
    coords: { lat: parseFloat(lat), lon: parseFloat(lon) },
  });
  renderRuta();
  toast(`${nombre} agregado a la ruta`);
}

function actualizarPreviewDash() {
  const preview = document.getElementById('dash-ruta-preview');
  if (!preview) return;
  if (!rutaClientes.length) {
    preview.innerHTML = `
      <div style="text-align:center;padding:14px;color:var(--text3);font-size:12px">
        Sin clientes en ruta.
        <span onclick="irA('rutas')" style="color:var(--o);cursor:pointer;font-weight:700">Agregar</span>
      </div>`;
    return;
  }
  const colores = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];
  preview.innerHTML = rutaClientes.map((c, i) => `
    <div class="ruta-preview-item">
      <div class="ruta-preview-num" style="background:${colores[i%colores.length]}">${i+1}</div>
      <span class="material-icons" style="font-size:18px;color:var(--text2)">${(TIPO_CONFIG[c.tipo]||TIPO_CONFIG.otros).icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.negocio}</div>
        ${c.encargado ? `<div style="font-size:10px;color:var(--text2)">${c.encargado}</div>` : ''}
      </div>
    </div>`).join('');
}


// ═══════════════════════════════════════════════════════════
//  3. CALCULADORA DE ESPUMAS
// ═══════════════════════════════════════════════════════════
const DENSIDADES_DEFAULT = {
  D12: { precio:180000, uso:'Tapicería liviana, cojines decorativos' },
  D18: { precio:220000, uso:'Base de colchones, tapicería suave' },
  D23: { precio:280000, uso:'Multipropósito, colchones económicos' },
  D26: { precio:320000, uso:'Colchones de calidad media' },
  D30: { precio:400000, uso:'Colchones institucionales, hoteles' },
  D40: { precio:520000, uso:'Industrial, médico, alta durabilidad' },
};

const COLORES_ESPUMA = [
  { nombre:'BL (Blanco)', hex:'#F8F8F8', textColor:'#333' },
  { nombre:'Rosa',        hex:'#FFB6C1', textColor:'#8B3A4A' },
  { nombre:'Gris',        hex:'#9E9E9E', textColor:'#333' },
  { nombre:'Gris Plata',  hex:'#C0C0C0', textColor:'#333' },
  { nombre:'Morada',      hex:'#9C27B0', textColor:'#fff' },
  { nombre:'Verde',       hex:'#4CAF50', textColor:'#fff' },
  { nombre:'Guayaba',     hex:'#FF6B8A', textColor:'#fff' },
  { nombre:'Azul',        hex:'#2196F3', textColor:'#fff' },
  { nombre:'Fucsia',      hex:'#E91E8C', textColor:'#fff' },
];

let tipoEspumaActual = 'Convencional';
let preciosDensidades = JSON.parse(localStorage.getItem('crm_espuma_precios') || 'null') || { ...DENSIDADES_DEFAULT };

function initCalculadora() {
  renderListaDensidades();
  renderColores();
  renderTablaDensidades();
}

function renderListaDensidades() {
  const lista = document.getElementById('lista-densidades');
  if (!lista) return;
  lista.innerHTML = Object.entries(preciosDensidades).map(([key, val]) => `
    <div class="densidad-item">
      <div class="densidad-badge">${key}</div>
      <div class="densidad-info">
        <div style="font-size:12px;font-weight:600">${key}</div>
        <div class="densidad-uso">${val.uso}</div>
      </div>
      <input class="densidad-precio-input inp" type="number" value="${val.precio}"
             onchange="actualizarPrecio('${key}', this.value)" min="0" step="1000">
    </div>`).join('');
}

function actualizarPrecio(key, valor) {
  preciosDensidades[key].precio = parseInt(valor) || 0;
  localStorage.setItem('crm_espuma_precios', JSON.stringify(preciosDensidades));
  renderTablaDensidades();
  calcularM3();
}

function renderColores() {
  const grid = document.getElementById('colores-grid');
  if (!grid) return;
  grid.innerHTML = COLORES_ESPUMA.map(c =>
    `<span class="color-chip" style="background:${c.hex};color:${c.textColor};border-color:transparent">${c.nombre}</span>`
  ).join('');
}

function renderTablaDensidades() {
  const tbody = document.getElementById('tabla-densidades-ref');
  if (!tbody) return;
  tbody.innerHTML = Object.entries(preciosDensidades).map(([key, val]) => `
    <tr>
      <td><span class="densidad-badge">${key}</span></td>
      <td style="font-size:12px">${val.uso}</td>
      <td><span class="st s-i">${tipoEspumaActual}</span></td>
      <td style="font-weight:700;color:var(--o)">$${val.precio.toLocaleString('es-CO')}</td>
      <td>
        <button class="btn bp bs" onclick="usarEnCalculadora('${key}')">
          <span class="material-icons" style="font-size:12px">calculate</span> Calcular
        </button>
      </td>
    </tr>`).join('');
}

function usarEnCalculadora(densidad) {
  const sel = document.getElementById('calc-densidad');
  if (sel) sel.value = densidad;
  calcularM3();
}

function setTipoEspuma(tipo) {
  tipoEspumaActual = tipo;
  document.getElementById('tipo-conv')?.classList.toggle('active', tipo === 'Convencional');
  document.getElementById('tipo-esp')?.classList.toggle('active',  tipo === 'Especial');
  renderTablaDensidades();
  calcularM3();
}

function calcularM3() {
  const densidad = document.getElementById('calc-densidad')?.value;
  const largo    = parseFloat(document.getElementById('calc-largo')?.value) || 0;
  const ancho    = parseFloat(document.getElementById('calc-ancho')?.value) || 0;
  const alto     = parseFloat(document.getElementById('calc-alto')?.value)  || 0;
  const m3El     = document.getElementById('res-m3');
  const precioEl = document.getElementById('res-precio-m3');
  const totalEl  = document.getElementById('res-total');

  if (!largo || !ancho || !alto || !densidad) {
    if (m3El)     m3El.textContent     = '— m³';
    if (precioEl) precioEl.textContent = '—';
    if (totalEl)  totalEl.textContent  = '$ —';
    return;
  }
  const m3       = (largo * ancho * alto) / 1000000;
  const precioM3 = preciosDensidades[densidad]?.precio || 0;
  const total    = m3 * precioM3;
  if (m3El)     m3El.textContent     = `${m3.toFixed(4)} m³`;
  if (precioEl) precioEl.textContent = `$${precioM3.toLocaleString('es-CO')} / m³`;
  if (totalEl)  totalEl.textContent  = `$${Math.round(total).toLocaleString('es-CO')}`;
}

function limpiarCalc() {
  ['calc-densidad','calc-largo','calc-ancho','calc-alto'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  calcularM3();
}

function compartirCotizacionEspuma() {
  const densidad = document.getElementById('calc-densidad')?.value;
  const largo    = document.getElementById('calc-largo')?.value;
  const ancho    = document.getElementById('calc-ancho')?.value;
  const alto     = document.getElementById('calc-alto')?.value;
  const color    = document.getElementById('calc-color')?.value;
  const total    = document.getElementById('res-total')?.textContent;
  if (!densidad || !largo || !ancho || !alto) { toast('Completa los datos del cálculo'); return; }
  const msg = encodeURIComponent(
    `Hola, le escribe *Cándida Caballero* de *Espumados del Litoral*.\n\n` +
    `*Cotización de Espuma*\n` +
    `Densidad: *${densidad}* (${tipoEspumaActual})\n` +
    `Dimensiones: ${largo} x ${ancho} x ${alto} cm\n` +
    `Color: ${color}\n` +
    `Volumen: ${((largo*ancho*alto)/1000000).toFixed(4)} m³\n` +
    `Total estimado: *${total}*\n\n` +
    `¿Le gustaría proceder con el pedido?`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}


// ═══════════════════════════════════════════════════════════
//  4. BITÁCORA
// ═══════════════════════════════════════════════════════════
let bitacoraData = JSON.parse(localStorage.getItem('crm_bitacora') || '[]');

function guardarBitacora() {
  const negocio = document.getElementById('bit-negocio')?.value.trim();
  if (!negocio) { toast('Ingresa el nombre del negocio'); return; }
  const registro = {
    id:    Date.now(), negocio,
    fecha: document.getElementById('bit-fecha')?.value || new Date().toISOString().split('T')[0],
    tipo:  document.getElementById('bit-tipo')?.value,
    obs:   document.getElementById('bit-obs')?.value,
    opp:   document.getElementById('bit-opp')?.value,
    prods: document.getElementById('bit-prods')?.value,
  };
  bitacoraData.unshift(registro);
  localStorage.setItem('crm_bitacora', JSON.stringify(bitacoraData));
  ['bit-negocio','bit-obs','bit-prods'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  cerrarModal('m-bitacora');
  cargarBitacora();
  toast('Registro guardado en bitácora');
}

function cargarBitacora() {
  const lista = document.getElementById('lista-bitacora');
  if (!lista) return;
  const q     = (document.getElementById('bq')?.value || '').toLowerCase();
  const fecha = document.getElementById('bq-fecha')?.value || '';
  const filtrados = bitacoraData.filter(r =>
    (!q    || r.negocio.toLowerCase().includes(q) || (r.obs||'').toLowerCase().includes(q)) &&
    (!fecha || r.fecha === fecha)
  );
  if (!filtrados.length) {
    lista.innerHTML = `
      <div style="text-align:center;padding:36px;color:var(--text3)">
        <span class="material-icons" style="font-size:36px;display:block;margin-bottom:8px">menu_book</span>
        Sin registros${q||fecha?' con ese filtro':''}
      </div>`; return;
  }
  const oppCfg = {
    alta:   { label:'Alta',    cls:'opp-alta'    },
    media:  { label:'Media',   cls:'opp-media'   },
    baja:   { label:'Baja',    cls:'opp-baja'    },
    ninguna:{ label:'Sin opp', cls:'opp-ninguna' },
  };
  const TIPO_ICO = {
    Hotel:'hotel', 'Clínica / IPS':'local_hospital',
    Motel:'bed', 'Oficina / Empresa':'business',
    Mueblería:'chair', Otros:'storefront',
  };
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  lista.innerHTML = filtrados.map(r => {
    const [yyyy,mm,dd] = (r.fecha||'').split('-');
    const mesStr = meses[(parseInt(mm,10)||1)-1] || '';
    const opp    = oppCfg[r.opp] || oppCfg.ninguna;
    const icon   = TIPO_ICO[r.tipo] || 'storefront';
    return `
    <div class="bitacora-card">
      <div class="bitacora-fecha-col">
        <div class="bitacora-dia">${dd||'—'}</div>
        <div class="bitacora-mes">${mesStr}</div>
        <div style="font-size:9px;color:var(--text3);margin-top:2px">${yyyy||''}</div>
      </div>
      <div class="bitacora-content">
        <div class="bitacora-negocio">
          <span class="material-icons" style="font-size:14px;vertical-align:middle;margin-right:4px">${icon}</span>${r.negocio}
        </div>
        ${r.obs ? `<div class="bitacora-obs">${r.obs}</div>` : ''}
        <div class="bitacora-tags">
          <span class="opp-badge ${opp.cls}">${opp.label}</span>
          ${r.prods ? `<span class="pt2">${r.prods}</span>` : ''}
          ${r.tipo  ? `<span class="pt2">${r.tipo}</span>`  : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn bg2 bi bs" onclick="eliminarBitacora(${r.id})" title="Eliminar">
          <span class="material-icons" style="font-size:14px">delete</span>
        </button>
        <button class="btn bp bi bs" onclick="waDesde('${r.negocio}')" title="WhatsApp">
          <span class="material-icons" style="font-size:14px">chat</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

function filtrarBitacora() { cargarBitacora(); }

function eliminarBitacora(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  bitacoraData = bitacoraData.filter(r => r.id !== id);
  localStorage.setItem('crm_bitacora', JSON.stringify(bitacoraData));
  cargarBitacora();
  toast('Registro eliminado');
}

function waDesde(negocio) {
  const msg = encodeURIComponent(
    `Hola, le escribe *Cándida Caballero* de *Espumados del Litoral*.\n` +
    `He registrado la visita a *${negocio}*. ¿Le gustaría continuar con la cotización o agendar una nueva visita?`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function exportarBitacora() {
  if (!bitacoraData.length) { toast('Sin registros en la bitácora'); return; }
  const lineas = bitacoraData.map(r =>
    `VISITA: ${r.negocio}\nFecha: ${r.fecha}\nTipo: ${r.tipo}\nOportunidad: ${r.opp}\nObservaciones: ${r.obs||'—'}\nProductos: ${r.prods||'—'}\n${'—'.repeat(30)}`
  ).join('\n\n');
  const cuerpo = encodeURIComponent(`Reporte de Bitácora — Cándida Caballero\nEspumados del Litoral · ${new Date().toLocaleDateString('es-CO')}\n\n${lineas}`);
  const asunto = encodeURIComponent('Reporte Bitácora Visitas — Espumados del Litoral');
  window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
}


// ═══════════════════════════════════════════════════════════
//  5. THEME
// ═══════════════════════════════════════════════════════════
let dark = true;

function toggleTheme() {
  dark = !dark;
  const tema = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', tema);
  const btn = document.getElementById('th-btn');
  if (btn) btn.innerHTML = dark
    ? '<span class="material-icons">dark_mode</span>'
    : '<span class="material-icons">light_mode</span>';
  actualizarCapaMapa(tema);
  updateCharts();          // ← actualiza gráficas al cambiar tema
  toast(dark ? 'Modo noche activado' : 'Modo día activado');
}


// ═══════════════════════════════════════════════════════════
//  6. SIDEBAR Y NAVEGACIÓN
// ═══════════════════════════════════════════════════════════
function abrirSB() {
  document.getElementById('sidebar').classList.add('active');
  document.getElementById('sb-overlay').classList.add('show');
}

function cerrarSB() {
  document.getElementById('sidebar').classList.remove('active');
  document.getElementById('sb-overlay').classList.remove('show');
}

const titles = {
  dashboard:   'Dashboard',
  clientes:    'Clientes',
  pipeline:    'Pipeline',
  portafolio:  'Portafolio',
  mapa:        'Mapa & Visitas',
  seguimiento: 'Seguimientos',
  asistente:   'Asistente IA',
  rutas:       'Ruta del Día',
  bitacora:    'Bitácora',
  calculadora: 'Calculadora Espumas',
};

function irA(name, btn, mob) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const tEl = document.getElementById('pg-title');
  if (tEl) tEl.innerHTML = `<span>${titles[name] || name}</span>`;

  if (!mob) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (btn) btn.classList.add('active');
  } else {
    document.querySelectorAll('.bni').forEach(n => n.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  cerrarSB();

  if (name === 'clientes')    cargarTablaClientes();
  if (name === 'seguimiento') cargarSeguimientos();
  if (name === 'calculadora') initCalculadora();
  if (name === 'bitacora')    cargarBitacora();
  if (name === 'rutas') setTimeout(() => { initMapaRuta(); if (mapaRuta) mapaRuta.invalidateSize(); }, 200);
  if (name === 'mapa')  setTimeout(() => { initMapaFull(); if (mapaFull) mapaFull.invalidateSize(); }, 200);

  // ── Pipeline: primero carga datos, luego kanban + gráficas ──
  if (name === 'pipeline') {
    const doRender = () => { renderPipeline(); initCharts(); };
    if (todasVisitas.length) {
      doRender();
    } else {
      cargarTablaClientes().then(doRender);
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  7. GPS
// ═══════════════════════════════════════════════════════════
let gpsData = { lat: null, lon: null };

function capturarGPS() {
  if (!navigator.geolocation) { toast('GPS no disponible en este dispositivo'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => { gpsData = { lat: pos.coords.latitude, lon: pos.coords.longitude }; toast('Ubicación capturada correctamente'); },
    err => toast('Error GPS: ' + err.message)
  );
}


// ═══════════════════════════════════════════════════════════
//  8. VISITAS
// ═══════════════════════════════════════════════════════════
async function guardarVisita() {
  const cli = document.getElementById('v-cliente')?.value.trim();
  if (!cli) { toast('Ingresa el nombre del cliente'); return; }
  await fetch('/registrar_visita', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      cliente:      cli,
      tipo_cliente: document.getElementById('v-tipo')?.value,
      producto:     document.getElementById('v-producto')?.value,
      lat: gpsData.lat, lon: gpsData.lon, estado:'Prospecto',
    }),
  });
  document.getElementById('v-cliente').value = '';
  gpsData = { lat:null, lon:null };
  toast('Visita registrada');
  setTimeout(() => location.reload(), 1200);
}

async function guardarVisitaModal() {
  const cli = document.getElementById('mv-cli')?.value.trim();
  if (!cli) { toast('Ingresa el nombre del cliente'); return; }
  await fetch('/registrar_visita', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      cliente:      cli,
      tipo_cliente: document.getElementById('mv-tipo')?.value,
      telefono:     document.getElementById('mv-tel')?.value,
      producto:     document.getElementById('mv-prod')?.value,
      estado:       document.getElementById('mv-est')?.value,
      notas:        document.getElementById('mv-notas')?.value,
      lat: gpsData.lat, lon: gpsData.lon,
    }),
  });
  cerrarModal('m-visita');
  toast('Visita guardada en base de datos');
  setTimeout(() => location.reload(), 1200);
}


// ═══════════════════════════════════════════════════════════
//  9. TABLA CLIENTES
// ═══════════════════════════════════════════════════════════
let todasVisitas = [];

async function cargarTablaClientes() {
  const r = await fetch('/obtener_visitas');
  todasVisitas = await r.json();
  renderTabla(todasVisitas);
}

function renderTabla(data) {
  const stMap = { Prospecto:'s-p', Contactado:'s-c', Interesado:'s-i', Cotización:'s-q', Cliente:'s-k' };
  const tbody = document.getElementById('tb-clientes');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(v => `
    <tr>
      <td><b>${v.cliente}</b></td>
      <td style="font-size:11px">${v.tipo_cliente||'—'}</td>
      <td style="font-size:11px">${v.producto||'—'}</td>
      <td><span class="st ${stMap[v.estado]||'s-p'}">${v.estado}</span></td>
      <td style="font-size:11px;color:var(--text2)">${v.fecha}</td>
      <td>${v.latitud
        ? `<a href="https://maps.google.com?q=${v.latitud},${v.longitud}" target="_blank" style="color:var(--info);text-decoration:none;font-size:11px">Ver mapa</a>`
        : '—'}</td>
      <td>
        <button class="btn bg2 bi bs" onclick="wa('${v.cliente}')" title="WhatsApp">
          <span class="material-icons" style="font-size:14px">chat</span>
        </button>
        <button class="btn bg2 bi bs" onclick="delVisita(${v.id})" title="Eliminar">
          <span class="material-icons" style="font-size:14px">delete</span>
        </button>
      </td>
    </tr>`).join('')
  : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text2)">Sin clientes registrados</td></tr>';
}

function filtrarTabla() {
  const q   = document.getElementById('sq')?.value.toLowerCase() || '';
  const est = document.getElementById('sf-est')?.value || '';
  const tip = document.getElementById('sf-tipo')?.value || '';
  renderTabla(todasVisitas.filter(v =>
    (!q   || v.cliente.toLowerCase().includes(q)) &&
    (!est || v.estado === est) &&
    (!tip || v.tipo_cliente === tip)
  ));
}

async function delVisita(id) {
  if (!confirm('¿Eliminar esta visita?')) return;
  await fetch('/eliminar_visita/' + id, { method:'DELETE' });
  cargarTablaClientes();
  toast('Visita eliminada');
}

function wa(nombre) {
  const msg = encodeURIComponent(
    `Hola, buenos días.\nLe escribe *Cándida Caballero* de *Espumados del Litoral*.\n` +
    `Quería hacer seguimiento sobre los productos que le presentamos a *${nombre}*. ` +
    `¿Tiene alguna duda o podemos agendar una visita?`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function compartirWA(producto) {
  const msg = encodeURIComponent(
    `Hola, le escribe *Cándida Caballero*, Asesora Institucional de *Espumados del Litoral*.\n\n` +
    `Le comparto información del producto *${producto}*, ideal para uso institucional.\n\n` +
    `¿Le gustaría recibir más detalles o agendar una visita?`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}


// ═══════════════════════════════════════════════════════════
//  10. PIPELINE KANBAN
// ═══════════════════════════════════════════════════════════
const stages = [
  { id:'Prospecto',  lbl:'Prospecto',  c:'#F59E0B' },
  { id:'Contactado', lbl:'Contactado', c:'#3B82F6' },
  { id:'Interesado', lbl:'Interesado', c:'#F05A1A' },
  { id:'Cotización', lbl:'Cotización', c:'#A855F7' },
  { id:'Cliente',    lbl:'Cliente',    c:'#22C55E' },
];

function renderPipeline() {
  const board = document.getElementById('pipe-board');
  if (!board) return;
  board.innerHTML = stages.map(s => {
    const items = todasVisitas.filter(v => v.estado === s.id);
    return `
    <div class="pcol">
      <div class="ph" style="background:${s.c}20;color:${s.c}">${s.lbl}<span>${items.length}</span></div>
      <div class="pb3">
        ${items.map(v => `
          <div class="pi">
            <div class="pi-n">${v.cliente}</div>
            <div class="pi-s">${v.producto||'—'}</div>
          </div>`).join('') ||
          '<div style="text-align:center;color:var(--text3);font-size:10px;padding:16px">Sin registros</div>'}
      </div>
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════════════════════════
//  11. GRÁFICAS PIPELINE — Chart.js
// ═══════════════════════════════════════════════════════════
let chartFunnel  = null;
let chartTipo    = null;
let chartSemanal = null;

function getCC() {
  const d = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: d ? '#A0A8C0' : '#5A4A38',
    grid: d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
  };
}

function initCharts() {
  // Si los canvas no existen aún (página no activa), salir
  const cFunnel  = document.getElementById('chartFunnel');
  const cTipo    = document.getElementById('chartTipo');
  const cSemanal = document.getElementById('chartSemanal');
  if (!cFunnel || !cTipo || !cSemanal) return;

  const cc = getCC();
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

  // ── Destruir instancias previas si existen ──
  if (chartFunnel)  { chartFunnel.destroy();  chartFunnel  = null; }
  if (chartTipo)    { chartTipo.destroy();    chartTipo    = null; }
  if (chartSemanal) { chartSemanal.destroy(); chartSemanal = null; }

  // ── Datos reales desde todasVisitas ──
  const contarEstado = (id) => todasVisitas.filter(v => v.estado === id).length;
  const tipos = ['Hotel','Clínica','Motel','IPS','Oficina / Empresa'];
  const contarTipo = (t) => todasVisitas.filter(v => v.tipo_cliente === t).length;

  // Embudo de ventas (barras)
  chartFunnel = new Chart(cFunnel, {
    type: 'bar',
    data: {
      labels: stages.map(s => s.lbl),
      datasets: [{
        data: stages.map(s => contarEstado(s.id)),
        backgroundColor: stages.map(s => s.c + '88'),
        borderColor:     stages.map(s => s.c),
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks:{ color:cc.text, font:{size:11} }, grid:{ color:cc.grid } },
        y: { ticks:{ color:cc.text, font:{size:11}, stepSize:1 }, grid:{ color:cc.grid }, beginAtZero:true },
      },
    },
  });

  // Clientes por tipo (dona)
  chartTipo = new Chart(cTipo, {
    type: 'doughnut',
    data: {
      labels: tipos,
      datasets: [{
        data: tipos.map(contarTipo),
        backgroundColor: ['#F05A1A','#3B82F6','#F59E0B','#22C55E','#A855F7'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color:cc.text, font:{size:11}, padding:10, usePointStyle:true },
        },
      },
    },
  });

  // Actividad semanal (línea) — datos ilustrativos
  chartSemanal = new Chart(cSemanal, {
    type: 'line',
    data: {
      labels: ['Lun','Mar','Mié','Jue','Vie','Sáb'],
      datasets: [
        {
          label: 'Visitas',
          data: [2,4,3,5,4,2],
          borderColor: '#F05A1A',
          backgroundColor: 'rgba(240,90,26,0.1)',
          borderWidth: 2.5, fill: true, tension: .4,
          pointRadius: 4, pointBackgroundColor: '#F05A1A',
          pointBorderColor: '#fff', pointBorderWidth: 2,
        },
        {
          label: 'Cotizaciones',
          data: [1,2,1,3,2,1],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2, fill: true, tension: .4,
          pointRadius: 3, pointBackgroundColor: '#3B82F6',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels:{ color:cc.text, font:{size:11}, usePointStyle:true } } },
      scales: {
        x: { ticks:{ color:cc.text, font:{size:11} }, grid:{ color:cc.grid } },
        y: { ticks:{ color:cc.text, font:{size:11}, stepSize:1 }, grid:{ color:cc.grid }, beginAtZero:true },
      },
    },
  });
}

function updateCharts() {
  if (!chartFunnel) return;
  const cc = getCC();
  [chartFunnel, chartSemanal].forEach(ch => {
    if (!ch) return;
    if (ch.options.scales?.x) { ch.options.scales.x.ticks.color = cc.text; ch.options.scales.x.grid.color = cc.grid; }
    if (ch.options.scales?.y) { ch.options.scales.y.ticks.color = cc.text; ch.options.scales.y.grid.color = cc.grid; }
    ch.update();
  });
  if (chartTipo?.options?.plugins?.legend?.labels) {
    chartTipo.options.plugins.legend.labels.color = cc.text;
    chartTipo.update();
  }
}


// ═══════════════════════════════════════════════════════════
//  12. PORTAFOLIO
// ═══════════════════════════════════════════════════════════
function fprod(cat, btn) {
  document.querySelectorAll('#grid-prod .pc').forEach(c => {
    c.style.display = (cat==='todos' || c.dataset.cat===cat) ? '' : 'none';
  });
  // Actualizar botón activo
  if (btn) {
    document.querySelectorAll('#page-portafolio .btn-group .btn').forEach(b => b.classList.remove('filter-active'));
    btn.classList.add('filter-active');
  }
}

function verFichaDB(nombre, desc, img, mat, med, gar, firmeza, altura) {
  document.getElementById('m-ficha-body').innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:18px">
      <span class="material-icons" style="font-size:48px;color:var(--o);flex-shrink:0">bed</span>
      <div>
        <div style="font-family:'Clash Display',sans-serif;font-size:20px;font-weight:800">${nombre}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px;font-style:italic">${desc}</div>
      </div>
    </div>
    <div class="g2" style="margin-bottom:14px">
      <div style="background:var(--card2);border-radius:11px;padding:12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px">FIRMEZA</div>
        <div style="font-weight:700;color:var(--o)">${firmeza||'—'}</div>
      </div>
      <div style="background:var(--card2);border-radius:11px;padding:12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px">ALTURA</div>
        <div style="font-weight:700">${altura||'—'}</div>
      </div>
      <div style="background:var(--card2);border-radius:11px;padding:12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px">GARANTÍA</div>
        <div style="font-weight:700;color:var(--ok)">${gar}</div>
      </div>
      <div style="background:var(--card2);border-radius:11px;padding:12px">
        <div style="font-size:10px;color:var(--text2);margin-bottom:3px">MATERIALES</div>
        <div style="font-weight:700;font-size:11px">${mat}</div>
      </div>
    </div>
    <div style="background:var(--card2);border-radius:11px;padding:12px;margin-bottom:16px">
      <div style="font-size:10px;color:var(--text2);margin-bottom:5px">MEDIDAS</div>
      <div style="font-size:12px;line-height:1.9">${med}</div>
    </div>
    <div style="display:flex;gap:9px;justify-content:flex-end">
      <button class="btn bg2" onclick="cerrarModal('m-ficha')">Cerrar</button>
      <button class="btn bp" onclick="compartirWA('${nombre}');cerrarModal('m-ficha')">
        <span class="material-icons" style="font-size:14px">share</span> Compartir
      </button>
    </div>`;
  abrirModal('m-ficha');
}


// ═══════════════════════════════════════════════════════════
//  13. SEGUIMIENTOS
// ═══════════════════════════════════════════════════════════
async function cargarSeguimientos() {
  const r    = await fetch('/api/seguimientos');
  const segs = await r.json();
  const cols = { alta:'var(--err)', media:'var(--warn)', baja:'var(--ok)' };
  const el   = document.getElementById('list-seguimientos');
  if (!el) return;
  el.innerHTML = segs.length
    ? segs.map(s => `
      <div class="fu">
        <div class="fd" style="background:${cols[s.prioridad]}"></div>
        <div class="fb">
          <div class="fn">${s.cliente}</div>
          <div class="fdt">${s.accion}</div>
        </div>
        <div class="fr">
          <div class="fdate">${s.fecha||'—'}</div>
          <div style="font-size:9px;color:var(--text2)">${(s.prioridad||'').toUpperCase()}</div>
        </div>
        <button class="btn bg2 bi bs" onclick="completarSeg(${s.id})" title="Completado">
          <span class="material-icons" style="font-size:14px">check</span>
        </button>
      </div>`).join('')
    : `<div class="card" style="text-align:center;padding:36px">
         <span class="material-icons" style="font-size:36px;color:var(--ok);display:block;margin-bottom:10px">check_circle</span>
         <b>Sin seguimientos pendientes</b>
       </div>`;
}

async function guardarSeg() {
  const cli = document.getElementById('ns-c')?.value.trim();
  if (!cli) { toast('Ingresa el cliente'); return; }
  await fetch('/api/seguimientos', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      cliente:   cli,
      accion:    document.getElementById('ns-a')?.value,
      fecha:     document.getElementById('ns-f')?.value,
      prioridad: document.getElementById('ns-p')?.value,
    }),
  });
  cerrarModal('m-seguimiento');
  cargarSeguimientos();
  toast('Seguimiento guardado');
}

async function completarSeg(id) {
  await fetch('/api/seguimientos/' + id, { method:'DELETE' });
  cargarSeguimientos();
  toast('Seguimiento completado');
}


// ═══════════════════════════════════════════════════════════
//  14. ASISTENTE IA
// ═══════════════════════════════════════════════════════════
const aiCtx = `Eres el asistente de ventas de Espumados del Litoral, Barranquilla, Colombia.
Asistes a Cándida Caballero, Asesora Institucional.

PORTAFOLIO 2026:
- Imperial Hotel Resortado: adaptable, 37cm, 6 capas, resorte bonnel, garantía 5 años
- Imperial Hotel Firme: firme, 30cm, 3 capas, Extra Support, garantía 5 años
- Colchoneta Antiescaras: firme, 13cm, Cuerotex/Ferrini, uso hospitalario
- Almohada Confort M: 14cm, garantía 6 meses
- Almohada Confort S: 12cm, garantía 6 meses
- Almohada Esencial M/S: 10-12cm, garantía 3 meses
- Cojín TV Euro: 43cm
ESPUMAS: D12 (muy suave), D18 (suave), D23 (media), D26 (media-firme), D30 (firme/institucional), D40 (extra firme/industrial). 9 colores disponibles.
ESPONJAS: línea institucional para hoteles, clínicas, empresas.

Responde siempre en español profesional y cálido.
Cuando te pidan mensajes de WhatsApp o correos, redáctalos completos y listos para copiar.`;

async function enviarIA() {
  const inp = document.getElementById('cinp');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  addMsgIA(msg, 'me');
  const typ = addTypIA();
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: msg }),
    });
    const d = await r.json();
    typ.remove();
    addMsgIA(d.error ? ('Error: ' + d.error) : (d.respuesta || 'Sin respuesta.'), 'ai');
  } catch (e) {
    typ.remove();
    addMsgIA('Error de conexión. Intenta de nuevo.', 'ai');
  }
}

function qIA(q) { document.getElementById('cinp').value = q; enviarIA(); }

function addMsgIA(txt, role) {
  const w    = document.getElementById('chat-msgs');
  const isAI = role === 'ai';

  if (isAI) {
    const wrap = document.createElement('div');
    wrap.className = 'msg-ai-wrap';
    const avatar = document.createElement('img');
    avatar.className = 'ai-avatar';
    avatar.src = '/static/img/ai_avatar.jpg?v=1';    avatar.onerror = () => { avatar.src = 'https://ui-avatars.com/api/?name=IA&background=1E2330&color=F05A1A'; };
    avatar.alt = 'Asistente IA';
    const bubble = document.createElement('div');
    bubble.className = 'msg-ai';
    bubble.innerHTML = `<div class="msg-label">Asistente Litoral</div>${txt.replace(/\n/g, '<br>')}`;
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    w.appendChild(wrap);
  } else {
    const d = document.createElement('div');
    d.className = 'msg-me';
    d.textContent = txt;
    w.appendChild(d);
  }
  w.scrollTop = w.scrollHeight;
}

function addTypIA() {
  const w = document.createElement('div');
  w.className = 'msg-ai-wrap';
  const avatar = document.createElement('img');
  avatar.className = 'ai-avatar';
  avatar.src = '/static/img/ai_avatar.jpg';
  avatar.onerror = () => { avatar.src = 'https://ui-avatars.com/api/?name=IA&background=1E2330&color=F05A1A'; };
  const bubble = document.createElement('div');
  bubble.className = 'msg-ai';
  bubble.innerHTML = `
    <div class="msg-label">Asistente Litoral</div>
    <div style="display:flex;gap:4px;margin-top:4px">
      ${'<span style="width:6px;height:6px;border-radius:50%;background:var(--text2);animation:bounce 1.2s infinite"></span>'.repeat(3)}
    </div>`;
  if (!document.getElementById('bounce-style')) {
    const s = document.createElement('style');
    s.id = 'bounce-style';
    s.textContent = '@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}';
    document.head.appendChild(s);
  }
  w.appendChild(avatar);
  w.appendChild(bubble);
  const chat = document.getElementById('chat-msgs');
  chat.appendChild(w);
  chat.scrollTop = chat.scrollHeight;
  return w;
}


// ═══════════════════════════════════════════════════════════
//  15. MODALES Y TOAST
// ═══════════════════════════════════════════════════════════
function abrirModal(id)  { document.getElementById(id)?.classList.add('open'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('open'); }

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('t-txt').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}


// ═══════════════════════════════════════════════════════════
//  16. FECHA
// ═══════════════════════════════════════════════════════════
function updateDate() {
  const el = document.getElementById('top-date');
  if (el) el.textContent = new Date().toLocaleDateString('es-CO', {
    weekday:'long', day:'numeric', month:'long',
  });
}


// ═══════════════════════════════════════════════════════════
//  17. INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setTimeout(initMapaHome, 300);
  cargarTablaClientes();
  cargarSeguimientos();

  const bitFecha = document.getElementById('bit-fecha');
  if (bitFecha) bitFecha.value = new Date().toISOString().split('T')[0];

  document.querySelectorAll('.mo').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
  );
});