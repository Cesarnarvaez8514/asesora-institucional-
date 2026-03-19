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
  ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {attribution:'© OpenStreetMap © CARTO'})
  : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'});

let tileHome  = null;
let tileFull  = null;
let tileRuta  = null;

function initMapaHome() {
  if (mapaHome || !document.getElementById('mapa-litoral')) return;
  mapaHome = L.map('mapa-litoral').setView([10.9685, -74.7813], 13);
  tileHome = _tiles(true); tileHome.addTo(mapaHome);
  cargarPuntosEnMapa(mapaHome);
}

function initMapaFull() {
  if (mapaFull || !document.getElementById('mapa-litoral-full')) return;
  mapaFull = L.map('mapa-litoral-full').setView([10.9685, -74.7813], 13);
  tileFull = _tiles(true); tileFull.addTo(mapaFull);
  cargarPuntosEnMapa(mapaFull);
}

function initMapaRuta() {
  if (mapaRuta || !document.getElementById('mapa-ruta')) return;
  mapaRuta = L.map('mapa-ruta').setView([10.9685, -74.7813], 13);
  tileRuta = _tiles(true); tileRuta.addTo(mapaRuta);
  renderizarMapaRuta();
}

function actualizarCapaMapa(tema) {
  const isDark = tema === 'dark';
  [[mapaHome, 'tileHome'], [mapaFull, 'tileFull'], [mapaRuta, 'tileRuta']].forEach(([mapa, varName]) => {
    if (!mapa) return;
    const oldTile = eval(varName);
    if (oldTile) try { mapa.removeLayer(oldTile); } catch(e) {}
    const newTile = _tiles(isDark);
    newTile.addTo(mapa);
    eval(`${varName} = newTile`);
  });
}

// Color por estado
function estadoColor(estado) {
  return {
    'Prospecto':'#F59E0B','Contactado':'#3B82F6','Interesado':'#F05A1A',
    'Cotización':'#A855F7','Negociación':'#EC4899','Cliente':'#22C55E',
  }[estado] || '#A0A8C0';
}

function stClass(e) {
  return {Prospecto:'s-p',Contactado:'s-c',Interesado:'s-i',Cotización:'s-q',Negociación:'s-n',Cliente:'s-k'}[e] || 's-p';
}

async function cargarPuntosEnMapa(mapa) {
  try {
    const res = await fetch('/obtener_visitas');
    const visitas = await res.json();
    visitas.forEach(v => {
      if (v.latitud && v.longitud) {
        const color = estadoColor(v.estado);
        L.circleMarker([v.latitud, v.longitud], {
          radius:9, fillColor:color, color:'#FFF', weight:2, fillOpacity:.85
        }).addTo(mapa).bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${v.cliente}</div>
            <div style="font-size:11px;color:#666;margin-bottom:4px">${v.producto||'—'}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${color}22;color:${color}">${v.estado}</div>
          </div>`);
      }
    });
    const tbody = document.getElementById('tabla-visitas');
    if (tbody) {
      tbody.innerHTML = visitas.length ? visitas.map(v => `
        <tr>
          <td style="font-size:11px;color:var(--text2)">${v.fecha}</td>
          <td><b>${v.cliente}</b></td>
          <td style="font-size:11px">${v.producto||'—'}</td>
          <td><span class="st ${stClass(v.estado)}">${v.estado}</span></td>
          <td>${v.latitud
            ? `<a href="https://www.google.com/maps?q=${v.latitud},${v.longitud}" target="_blank" style="color:var(--info);text-decoration:none;font-size:12px">📍 Ver</a>`
            : '<span style="color:var(--text3);font-size:11px">Sin GPS</span>'
          }</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text2)">Sin visitas registradas aún</td></tr>';
    }
  } catch(e) { console.error('Error cargando mapa:', e); }
}


// ═══════════════════════════════════════════════════════════
//  2. RUTAS DEL DÍA
// ═══════════════════════════════════════════════════════════
let rutaClientes = [];
const RUTA_MAX = 5;

const TIPO_CONFIG = {
  hotel:    { icon:'🏨', colorClass:'tipo-hotel',    badgeClass:'badge-hotel' },
  hospital: { icon:'🏥', colorClass:'tipo-hospital', badgeClass:'badge-hospital' },
  oficina:  { icon:'🏢', colorClass:'tipo-oficina',  badgeClass:'badge-oficina' },
  otros:    { icon:'📦', colorClass:'tipo-otros',    badgeClass:'badge-otros' },
};

function agregarARuta() {
  const negocio   = document.getElementById('ar-negocio').value.trim();
  const encargado = document.getElementById('ar-encargado').value.trim();
  const tel       = document.getElementById('ar-tel').value.trim();
  const email     = document.getElementById('ar-email').value.trim();
  const tipo      = document.getElementById('ar-tipo').value;
  const dir       = document.getElementById('ar-dir').value.trim();

  if (!negocio) { if (typeof toast === 'function') toast('⚠️ Ingresa el nombre del negocio'); return; }
  if (rutaClientes.length >= RUTA_MAX) { if (typeof toast === 'function') toast(`⚠️ Máximo ${RUTA_MAX} clientes por ruta`); return; }

  rutaClientes.push({ id: Date.now(), negocio, encargado, tel, email, tipo, dir, coords: null });

  // Limpiar campos
  ['ar-negocio','ar-encargado','ar-tel','ar-email','ar-dir'].forEach(id => {
    document.getElementById(id).value = '';
  });
  if (typeof cerrarModal === 'function') cerrarModal('m-add-ruta');

  if (dir) geocodificarDireccion(rutaClientes[rutaClientes.length - 1]);
  renderRuta();
  if (typeof toast === 'function') toast('✅ Cliente agregado a la ruta');
}

async function geocodificarDireccion(cliente) {
  try {
    const q = encodeURIComponent(`${cliente.dir}, Barranquilla, Colombia`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const data = await res.json();
    if (data.length) {
      cliente.coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      renderizarMapaRuta();
    }
  } catch(e) { console.warn('Geocodificación falló:', e); }
}

function renderRuta() {
  const lista = document.getElementById('lista-ruta');
  const badge = document.getElementById('ruta-badge');
  const contador = document.getElementById('ruta-contador');
  const btnMaps = document.getElementById('btn-abrir-maps');

  if (badge) badge.textContent = rutaClientes.length;
  if (contador) contador.textContent = `${rutaClientes.length} / ${RUTA_MAX} clientes en ruta`;
  if (btnMaps) btnMaps.style.display = rutaClientes.length > 0 ? '' : 'none';

  if (!lista) return;
  if (!rutaClientes.length) {
    lista.innerHTML = `<div class="ruta-empty">
      <span class="material-icons" style="font-size:36px;color:var(--text3);display:block;margin-bottom:8px">route</span>
      Agrega hasta 5 clientes para planificar tu ruta de hoy
    </div>`;
    actualizarPreviewDash();
    return;
  }

  lista.innerHTML = rutaClientes.map((c, i) => {
    const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.otros;
    const colores = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];
    return `
    <div class="ruta-card" id="ruta-card-${c.id}">
      <div class="ruta-card-numero" style="background:${colores[i % colores.length]}">${i+1}</div>
      <div class="ruta-card-ico">${cfg.icon}</div>
      <div class="ruta-card-info">
        <div class="ruta-card-nombre">${c.negocio}</div>
        ${c.encargado ? `<div class="ruta-card-encargado">👤 ${c.encargado}</div>` : ''}
        <div class="ruta-card-contacto">
          ${c.tel   ? `<span class="ruta-card-tel">📱 ${c.tel}</span>` : ''}
          ${c.email ? `<span class="ruta-card-email">✉️ ${c.email}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="ruta-card-tipo-badge ${cfg.badgeClass}" style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px">${cfg.icon} ${c.tipo}</span>
          ${c.dir ? `<span style="font-size:10px;color:var(--text3)">📍 ${c.dir.substring(0,30)}${c.dir.length>30?'...':''}</span>` : ''}
          ${c.coords ? '<span style="font-size:10px;color:var(--ok)">✓ Geocodificado</span>' : ''}
        </div>
        <div class="ruta-card-actions">
          ${c.tel ? `<button class="btn bp bs" onclick="llamarCliente('${c.tel}')"><span class="material-icons" style="font-size:12px">call</span></button>` : ''}
          ${c.tel ? `<button class="btn bg2 bs" onclick="waRuta('${c.negocio}','${c.tel}')"><span style="font-size:12px">📲</span></button>` : ''}
        </div>
      </div>
      <button class="ruta-card-remove" onclick="eliminarDeRuta(${c.id})" title="Quitar de ruta">✕</button>
    </div>`;
  }).join('');

  actualizarPreviewDash();
  renderizarMapaRuta();
}

function eliminarDeRuta(id) {
  rutaClientes = rutaClientes.filter(c => c.id !== id);
  renderRuta();
  if (typeof toast === 'function') toast('🗑️ Cliente quitado de la ruta');
}

function llamarCliente(tel) {
  window.location.href = `tel:${tel}`;
}

function waRuta(nombre, tel) {
  const msg = encodeURIComponent(`Hola 👋, le escribe *Cándida Caballero* de *Espumados del Litoral* 🛏️\nEstoy en camino para visitarles. ¿Sigue disponible la reunión con *${nombre}*?`);
  window.open(`https://wa.me/57${tel.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

function optimizarRuta() {
  if (rutaClientes.length < 2) { if (typeof toast === 'function') toast('⚠️ Agrega al menos 2 clientes para optimizar'); return; }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const origen = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const conCoords = rutaClientes.filter(c => c.coords);
      if (conCoords.length < 2) { if (typeof toast === 'function') toast('⚠️ Agrega direcciones para optimizar la ruta'); return; }
      conCoords.sort((a, b) => {
        const da = distancia(origen.lat, origen.lon, a.coords.lat, a.coords.lon);
        const db = distancia(origen.lat, origen.lon, b.coords.lat, b.coords.lon);
        return da - db;
      });
      const sinCoords = rutaClientes.filter(c => !c.coords);
      rutaClientes = [...conCoords, ...sinCoords];
      renderRuta();
      if (typeof toast === 'function') toast('✅ Ruta optimizada: del más cercano al más lejano');
    }, () => { if (typeof toast === 'function') toast('⚠️ Activa el GPS para optimizar'); });
  }
}

function distancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let rutaPolyline = null;
let rutaMarkers  = [];

function renderizarMapaRuta() {
  if (!mapaRuta) return;
  rutaMarkers.forEach(m => mapaRuta.removeLayer(m));
  rutaMarkers = [];
  if (rutaPolyline) { mapaRuta.removeLayer(rutaPolyline); rutaPolyline = null; }

  const colores = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];
  const puntosConCoords = [];

  rutaClientes.forEach((c, i) => {
    if (!c.coords) return;
    const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.otros;
    const color = colores[i % colores.length];
    const marker = L.circleMarker([c.coords.lat, c.coords.lon], {
      radius:12, fillColor:color, color:'#fff', weight:2, fillOpacity:.9
    }).addTo(mapaRuta).bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:140px">
        <div style="font-size:10px;font-weight:800;color:${color}">PARADA ${i+1} ${cfg.icon}</div>
        <div style="font-weight:700;font-size:13px;margin:3px 0">${c.negocio}</div>
        ${c.encargado ? `<div style="font-size:11px;color:#666">${c.encargado}</div>` : ''}
        ${c.tel ? `<div style="font-size:11px;color:#3B82F6">${c.tel}</div>` : ''}
      </div>`);
    rutaMarkers.push(marker);
    puntosConCoords.push([c.coords.lat, c.coords.lon]);
  });

  if (puntosConCoords.length > 1) {
    rutaPolyline = L.polyline(puntosConCoords, {
      color:'#F05A1A', weight:3, opacity:.7, dashArray:'8 4'
    }).addTo(mapaRuta);
    mapaRuta.fitBounds(rutaPolyline.getBounds(), {padding:[20,20]});
  } else if (puntosConCoords.length === 1) {
    mapaRuta.setView(puntosConCoords[0], 15);
  }
}

function abrirEnGoogleMaps() {
  if (!rutaClientes.length) return;
  const conCoords = rutaClientes.filter(c => c.coords);
  if (conCoords.length < 1) {
    // Fallback: usar direcciones
    const dirs = rutaClientes.map(c => encodeURIComponent(c.dir || c.negocio + ' Barranquilla'));
    const url = `https://www.google.com/maps/dir/${dirs.join('/')}`;
    window.open(url, '_blank'); return;
  }
  const destinos = conCoords.map(c => `${c.coords.lat},${c.coords.lon}`);
  const dest = destinos.pop();
  const waypoints = destinos.join('|');
  const url = waypoints
    ? `https://www.google.com/maps/dir/current+location/${waypoints}/${dest}`
    : `https://www.google.com/maps/dir/current+location/${dest}`;
  window.open(url, '_blank');
}

async function buscarCercanos() {
  if (!navigator.geolocation) { if (typeof toast === 'function') toast('⚠️ GPS no disponible'); return; }
  if (typeof toast === 'function') toast('📡 Buscando negocios cercanos...');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const radio = 500; // metros
    // Buscar hoteles, hospitales y oficinas cercanos con Overpass API
    const query = `[out:json][timeout:10];(
      node["tourism"="hotel"](around:${radio},${lat},${lon});
      node["amenity"="hospital"](around:${radio},${lat},${lon});
      node["amenity"="clinic"](around:${radio},${lat},${lon});
      node["office"](around:${radio},${lat},${lon});
      node["building"="hotel"](around:${radio},${lat},${lon});
    );out body 15;`;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method:'POST', body:query
      });
      const data = await r.json();
      renderCercanos(data.elements, lat, lon);
    } catch(e) {
      // Fallback: mostrar simulación de búsqueda
      document.getElementById('lista-cercanos').innerHTML =
        '<div style="font-size:12px;color:var(--text3);padding:10px 0">No se pudo conectar con el servicio de mapa. Verifica la conexión.</div>';
    }
  }, () => { if (typeof toast === 'function') toast('⚠️ Activa el GPS'); });
}

function renderCercanos(elementos, latOrigen, lonOrigen) {
  const lista = document.getElementById('lista-cercanos');
  if (!elementos || !elementos.length) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0">No se encontraron negocios en 500m</div>';
    return;
  }
  const iconMap = {hotel:'🏨', hospital:'🏥', clinic:'🏥', office:'🏢'};
  lista.innerHTML = elementos.slice(0,8).map(el => {
    const nombre = el.tags?.name || el.tags?.['name:es'] || 'Negocio sin nombre';
    const tipo = el.tags?.tourism || el.tags?.amenity || el.tags?.office || 'negocio';
    const ico = iconMap[tipo] || '🏢';
    const dist = Math.round(distancia(latOrigen, lonOrigen, el.lat, el.lon) * 1000);
    return `<div class="cercano-chip" onclick="agregarCercanoARuta('${nombre}','${tipo}','${el.lat}','${el.lon}')">
      <span style="font-size:20px">${ico}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombre}</div>
        <div style="font-size:10px;color:var(--text2);text-transform:capitalize">${tipo}</div>
      </div>
      <span class="cercano-dist">${dist}m</span>
    </div>`;
  }).join('');
}

function agregarCercanoARuta(nombre, tipo, lat, lon) {
  if (rutaClientes.length >= RUTA_MAX) { if (typeof toast === 'function') toast('⚠️ Ruta llena (máx 5)'); return; }
  const tipoMap = {hotel:'hotel', hospital:'hospital', clinic:'hospital', office:'oficina'};
  rutaClientes.push({
    id: Date.now(), negocio: nombre, encargado: '', tel: '', email: '',
    tipo: tipoMap[tipo] || 'otros',
    dir: '', coords: { lat: parseFloat(lat), lon: parseFloat(lon) }
  });
  renderRuta();
  if (typeof toast === 'function') toast(`✅ ${nombre} agregado a la ruta`);
}

function actualizarPreviewDash() {
  const preview = document.getElementById('dash-ruta-preview');
  if (!preview) return;
  if (!rutaClientes.length) {
    preview.innerHTML = `<div style="text-align:center;padding:14px;color:var(--text3);font-size:12px">
      Sin clientes en ruta. <span onclick="irA('rutas')" style="color:var(--o);cursor:pointer;font-weight:700">Agregar →</span>
    </div>`;
    return;
  }
  const colores = ['#F05A1A','#3B82F6','#22C55E','#A855F7','#F59E0B'];
  preview.innerHTML = rutaClientes.map((c, i) => `
    <div class="ruta-preview-item">
      <div class="ruta-preview-num" style="background:${colores[i%colores.length]}">${i+1}</div>
      <span style="font-size:16px">${(TIPO_CONFIG[c.tipo]||TIPO_CONFIG.otros).icon}</span>
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
  D12: { precio: 180000, uso: 'Tapicería liviana, cojines decorativos' },
  D18: { precio: 220000, uso: 'Base de colchones, tapicería suave' },
  D23: { precio: 280000, uso: 'Multipropósito, colchones económicos' },
  D26: { precio: 320000, uso: 'Colchones de calidad media' },
  D30: { precio: 400000, uso: 'Colchones institucionales, hoteles' },
  D40: { precio: 520000, uso: 'Industrial, médico, alta durabilidad' },
};
const COLORES_ESPUMA = [
  { nombre:'BL (Blanco)',  hex:'#F8F8F8', textColor:'#333' },
  { nombre:'Rosa',         hex:'#FFB6C1', textColor:'#8B3A4A' },
  { nombre:'Gris',         hex:'#9E9E9E', textColor:'#333' },
  { nombre:'Gris Plata',   hex:'#C0C0C0', textColor:'#333' },
  { nombre:'Morada',       hex:'#9C27B0', textColor:'#fff' },
  { nombre:'Verde',        hex:'#4CAF50', textColor:'#fff' },
  { nombre:'Guayaba',      hex:'#FF6B8A', textColor:'#fff' },
  { nombre:'Azul',         hex:'#2196F3', textColor:'#fff' },
  { nombre:'Fucsia',       hex:'#E91E8C', textColor:'#fff' },
];

let tipoEspumaActual = 'Convencional';
let preciosDensidades = JSON.parse(localStorage.getItem('crm_espuma_precios') || 'null') || {...DENSIDADES_DEFAULT};

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
      <input
        class="densidad-precio-input"
        type="number"
        value="${val.precio}"
        onchange="actualizarPrecio('${key}', this.value)"
        min="0"
        step="1000">
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
  grid.innerHTML = COLORES_ESPUMA.map(c => `
    <span class="color-chip" style="background:${c.hex};color:${c.textColor};border-color:transparent">${c.nombre}</span>
  `).join('');
}

function renderTablaDensidades() {
  const tbody = document.getElementById('tabla-densidades-ref');
  if (!tbody) return;
  tbody.innerHTML = Object.entries(preciosDensidades).map(([key, val]) => `
    <tr>
      <td><span class="densidad-badge">${key}</span></td>
      <td style="font-size:12px">${val.uso}</td>
      <td><span class="st" style="background:rgba(240,90,26,.1);color:var(--o)">${tipoEspumaActual}</span></td>
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
  document.querySelector('.card-title')?.scrollIntoView({behavior:'smooth'});
}

function setTipoEspuma(tipo) {
  tipoEspumaActual = tipo;
  document.getElementById('tipo-conv')?.classList.toggle('active', tipo === 'Convencional');
  document.getElementById('tipo-esp')?.classList.toggle('active', tipo === 'Especial');
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
    if (m3El) m3El.textContent = '— m³';
    if (precioEl) precioEl.textContent = '—';
    if (totalEl) totalEl.textContent = '$ —';
    return;
  }
  const m3 = (largo * ancho * alto) / 1000000;
  const precioM3 = preciosDensidades[densidad]?.precio || 0;
  const total = m3 * precioM3;

  if (m3El)     m3El.textContent     = `${m3.toFixed(4)} m³`;
  if (precioEl) precioEl.textContent = `$${precioM3.toLocaleString('es-CO')} / m³`;
  if (totalEl)  totalEl.textContent  = `$${Math.round(total).toLocaleString('es-CO')}`;
}

function limpiarCalc() {
  ['calc-densidad','calc-largo','calc-ancho','calc-alto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
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

  if (!densidad || !largo || !ancho || !alto) {
    if (typeof toast === 'function') toast('⚠️ Completa los datos del cálculo'); return;
  }
  const msg = encodeURIComponent(
    `Hola 👋, le escribe *Cándida Caballero* de *Espumados del Litoral*.\n\n` +
    `📐 *Cotización de Espuma*\n` +
    `Densidad: *${densidad}* (${tipoEspumaActual})\n` +
    `Dimensiones: ${largo} × ${ancho} × ${alto} cm\n` +
    `Color: ${color}\n` +
    `Volumen: ${((largo*ancho*alto)/1000000).toFixed(4)} m³\n` +
    `💰 Total estimado: *${total}*\n\n` +
    `¿Le gustaría proceder con el pedido? 😊`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}


// ═══════════════════════════════════════════════════════════
//  4. BITÁCORA
// ═══════════════════════════════════════════════════════════
let bitacoraData = JSON.parse(localStorage.getItem('crm_bitacora') || '[]');

function guardarBitacora() {
  const negocio = document.getElementById('bit-negocio')?.value.trim();
  if (!negocio) { if (typeof toast === 'function') toast('⚠️ Ingresa el nombre del negocio'); return; }

  const registro = {
    id:       Date.now(),
    negocio,
    fecha:    document.getElementById('bit-fecha')?.value || new Date().toISOString().split('T')[0],
    tipo:     document.getElementById('bit-tipo')?.value,
    obs:      document.getElementById('bit-obs')?.value,
    opp:      document.getElementById('bit-opp')?.value,
    prods:    document.getElementById('bit-prods')?.value,
  };
  bitacoraData.unshift(registro);
  localStorage.setItem('crm_bitacora', JSON.stringify(bitacoraData));

  // Limpiar formulario
  ['bit-negocio','bit-obs','bit-prods'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  if (typeof cerrarModal === 'function') cerrarModal('m-bitacora');
  cargarBitacora();
  if (typeof toast === 'function') toast('✅ Registro guardado en bitácora');
}

function cargarBitacora() {
  const lista = document.getElementById('lista-bitacora');
  if (!lista) return;
  const q    = (document.getElementById('bq')?.value || '').toLowerCase();
  const fecha = document.getElementById('bq-fecha')?.value || '';

  const filtrados = bitacoraData.filter(r =>
    (!q    || r.negocio.toLowerCase().includes(q) || (r.obs||'').toLowerCase().includes(q)) &&
    (!fecha || r.fecha === fecha)
  );

  if (!filtrados.length) {
    lista.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3)">
      <span class="material-icons" style="font-size:36px;display:block;margin-bottom:8px">menu_book</span>
      Sin registros${q||fecha?' con ese filtro':''}
    </div>`; return;
  }

  const oppCfg = {
    alta:   { label:'🔥 Alta',   cls:'opp-alta'   },
    media:  { label:'🟡 Media',  cls:'opp-media'  },
    baja:   { label:'❄️ Baja',   cls:'opp-baja'   },
    ninguna:{ label:'➖ Sin opp',cls:'opp-ninguna' },
  };
  const TIPO_ICO = {Hotel:'🏨','Clínica / IPS':'🏥',Motel:'🛏️','Oficina / Empresa':'🏢',Mueblería:'🪑',Otros:'📦'};

  lista.innerHTML = filtrados.map(r => {
    const [yyyy, mm, dd] = (r.fecha||'').split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const mesStr = meses[(parseInt(mm,10)||1)-1] || '';
    const opp = oppCfg[r.opp] || oppCfg.ninguna;
    return `
    <div class="bitacora-card">
      <div class="bitacora-fecha-col">
        <div class="bitacora-dia">${dd||'—'}</div>
        <div class="bitacora-mes">${mesStr}</div>
        <div style="font-size:9px;color:var(--text3);margin-top:2px">${yyyy||''}</div>
      </div>
      <div class="bitacora-content">
        <div class="bitacora-negocio">${TIPO_ICO[r.tipo]||'🏢'} ${r.negocio}</div>
        ${r.obs ? `<div class="bitacora-obs">${r.obs}</div>` : ''}
        <div class="bitacora-tags">
          <span class="opp-badge ${opp.cls}">${opp.label}</span>
          ${r.prods ? `<span class="pt2">📦 ${r.prods}</span>` : ''}
          ${r.tipo  ? `<span class="pt2">${r.tipo}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn bg2 bi bs" onclick="eliminarBitacora(${r.id})" title="Eliminar">🗑️</button>
        <button class="btn bp bi bs" onclick="waDesde('${r.negocio}')" title="WhatsApp">📲</button>
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
  if (typeof toast === 'function') toast('🗑️ Eliminado');
}

function waDesde(negocio) {
  const msg = encodeURIComponent(`Hola 👋, le escribe *Cándida Caballero* de *Espumados del Litoral* 🛏️\nHe registrado la visita a *${negocio}*. ¿Le gustaría continuar con la cotización o agendar una nueva visita?`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function exportarBitacora() {
  if (!bitacoraData.length) { if (typeof toast === 'function') toast('⚠️ Sin registros en la bitácora'); return; }

  const lineas = bitacoraData.map(r => {
    return `VISITA: ${r.negocio}\nFecha: ${r.fecha}\nTipo: ${r.tipo}\nOportunidad: ${r.opp}\nObservaciones: ${r.obs||'—'}\nProductos: ${r.prods||'—'}\n${'—'.repeat(30)}`;
  }).join('\n\n');

  const cuerpo = encodeURIComponent(
    `Reporte de Bitácora — Cándida Caballero\nEspumados del Litoral · ${new Date().toLocaleDateString('es-CO')}\n\n${lineas}`
  );
  const asunto = encodeURIComponent('Reporte Bitácora Visitas — Espumados del Litoral');
  window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
}


// ═══════════════════════════════════════════════════════════
//  5. INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Mapa dashboard
  setTimeout(initMapaHome, 300);

  // Fecha default del modal de bitácora
  const bitFecha = document.getElementById('bit-fecha');
  if (bitFecha) bitFecha.value = new Date().toISOString().split('T')[0];

  // Inicializar calculadora si ya está activa
  const calcPage = document.getElementById('page-calculadora');
  if (calcPage && calcPage.classList.contains('active')) initCalculadora();
});