from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import json

app = Flask(__name__)
app.secret_key = 'litoral_secret_key_2026'

# ===== BASE DE DATOS =====
basedir       = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
if not os.path.exists(instance_path):
    os.makedirs(instance_path)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(instance_path, 'crm_litoral.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ===== MODELOS =====
class Usuario(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    nombre   = db.Column(db.String(100))
    foto     = db.Column(db.String(100), default='perfil.jpg.jpeg')

class Producto(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    nombre      = db.Column(db.String(100), nullable=False)
    categoria   = db.Column(db.String(50))
    descripcion = db.Column(db.String(300))
    imagen      = db.Column(db.String(100))
    materiales  = db.Column(db.String(200))
    medidas     = db.Column(db.String(100))
    garantia    = db.Column(db.String(50))
    firmeza     = db.Column(db.String(50))
    altura      = db.Column(db.String(30))

class Visita(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    fecha            = db.Column(db.DateTime, default=datetime.now)
    cliente          = db.Column(db.String(100), nullable=False)
    tipo_cliente     = db.Column(db.String(50))
    producto_interes = db.Column(db.String(100))
    latitud          = db.Column(db.Float)
    longitud         = db.Column(db.Float)
    estado           = db.Column(db.String(30), default='Prospecto')
    notas            = db.Column(db.String(300))
    telefono         = db.Column(db.String(20))

class Seguimiento(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    cliente    = db.Column(db.String(100), nullable=False)
    accion     = db.Column(db.String(200))
    fecha      = db.Column(db.String(20))
    prioridad  = db.Column(db.String(20), default='media')
    completado = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

class Cotizacion(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    cliente    = db.Column(db.String(100))
    empresa    = db.Column(db.String(100))
    telefono   = db.Column(db.String(20))
    productos  = db.Column(db.Text)
    total      = db.Column(db.Float)
    estado     = db.Column(db.String(30), default='Enviada')
    created_at = db.Column(db.DateTime, default=datetime.now)

# ===== DATOS INICIALES =====
def cargar_datos():
    if Producto.query.count() == 0:
        productos = [
            Producto(
                nombre='Imperial Hotel Resortado', categoria='Hotelera',
                descripcion='La esencia que acaricia el ambiente con misterio y encanto. 6 capas de espuma flexible y resorte bonnel.',
                imagen='resortado.jpg',
                materiales='Espuma flexible de poliuretano + Resorte Bonnel',
                medidas='Sencillo 100x190 / Semi 120x190 / Doble 140x190 / Queen 160x190 / King 200x200',
                garantia='5 años', firmeza='Adaptable', altura='37 cm',
            ),
            Producto(
                nombre='Imperial Hotel Firme', categoria='Hotelera',
                descripcion='Diseñado para ofrecer confort duradero. 3 capas de espuma de alta densidad.',
                imagen='firme.jpg',
                materiales='Extra Support + Perfect Support',
                medidas='Sencillo 100x190 / Semi 120x190 / Doble 140x190 / Queen 160x190 / King 200x200',
                garantia='5 años', firmeza='Firme', altura='30 cm',
            ),
            Producto(
                nombre='Colchoneta Antiescaras', categoria='Hospitalaria',
                descripcion='Diseñada para brindar confort y cuidado. Tela Cuerotex o Ferrini, con y sin cremallera.',
                imagen='antiescaras.jpg',
                materiales='Total Support — Espuma alta densidad',
                medidas='Estandar camilla hospitalaria',
                garantia='—', firmeza='Firme', altura='13 cm',
            ),
            Producto(
                nombre='Almohada Confort M', categoria='Almohadas',
                descripcion='Suenos ligeros, mananas perfectas. Funda extraible y lavable.',
                imagen='confort m.jpg',
                materiales='Perfect Support + Sensafoam',
                medidas='40x60', garantia='6 meses', firmeza='Adaptable', altura='14 cm',
            ),
            Producto(
                nombre='Almohada Confort S', categoria='Almohadas',
                descripcion='Suenos ligeros, mananas perfectas. Funda extraible y lavable.',
                imagen='confort s.jpg',
                materiales='Perfect Support',
                medidas='40x60', garantia='6 meses', firmeza='Adaptable', altura='12 cm',
            ),
            Producto(
                nombre='Almohada Esencial M', categoria='Almohadas',
                descripcion='Suenos ligeros, mananas perfectas.',
                imagen='esencial m.jpg',
                materiales='Espuma',
                medidas='40x60', garantia='3 meses', firmeza='Adaptable', altura='12 cm',
            ),
            Producto(
                nombre='Almohada Esencial S', categoria='Almohadas',
                descripcion='Suenos ligeros, mananas perfectas.',
                imagen='esencial s.jpg',
                materiales='Espuma',
                medidas='40x60', garantia='3 meses', firmeza='Adaptable', altura='10 cm',
            ),
            Producto(
                nombre='Cojin TV Euro', categoria='Complementos',
                descripcion='Disfruta del confort sin interrupciones. Tela Col Tejido Punto.',
                imagen='tv euro.jpg',
                materiales='Espuma',
                medidas='45x47', garantia='3 meses', firmeza='Firme', altura='43 cm',
            ),
        ]
        db.session.bulk_save_objects(productos)
        db.session.commit()
        print('Productos cargados')

def crear_usuario_maestro():
    if not Usuario.query.filter_by(username='candida_litoral').first():
        user = Usuario(
            username='candida_litoral',
            password='Litoral2026',
            nombre='Candida Caballero',
            foto='perfil.jpg.jpeg',
        )
        db.session.add(user)
        db.session.commit()
        print('Usuario creado')

# ===== DECORADOR LOGIN =====
def login_requerido(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# ===== RUTAS PRINCIPALES =====
@app.route('/')
@login_requerido
def home():
    productos     = Producto.query.all()
    total_visitas = Visita.query.count()
    cotizaciones  = Visita.query.filter_by(estado='Cotizacion').count()
    clientes      = Visita.query.filter_by(estado='Cliente').count()
    seguimientos  = Seguimiento.query.filter_by(completado=False).count()
    stats = {
        'total_clientes': total_visitas,
        'cotizaciones':   cotizaciones,
        'cierres':        clientes,
        'seguimientos':   seguimientos,
    }
    usuario = Usuario.query.filter_by(username=session['usuario']).first()
    return render_template('index.html', productos=productos, stats=stats, usuario=usuario)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'usuario' in session:
        return redirect(url_for('home'))
    error = None
    if request.method == 'POST':
        user  = request.form.get('username', '').strip()
        passw = request.form.get('password', '').strip()
        usuario_db = Usuario.query.filter_by(username=user, password=passw).first()
        if usuario_db:
            session['usuario'] = user
            return redirect(url_for('home'))
        error = 'Usuario o contrasena incorrectos'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('usuario', None)
    return redirect(url_for('login'))

# ===== API VISITAS =====
@app.route('/registrar_visita', methods=['POST'])
@login_requerido
def registrar_visita():
    data  = request.json
    nueva = Visita(
        cliente          = data.get('cliente'),
        tipo_cliente     = data.get('tipo_cliente', ''),
        producto_interes = data.get('producto', ''),
        latitud          = data.get('lat'),
        longitud         = data.get('lon'),
        estado           = data.get('estado', 'Prospecto'),
        notas            = data.get('notas', ''),
        telefono         = data.get('telefono', ''),
    )
    db.session.add(nueva)
    db.session.commit()
    return jsonify({'ok': True, 'id': nueva.id})

@app.route('/obtener_visitas')
@login_requerido
def obtener_visitas():
    """
    CORREGIDO: ahora devuelve tipo_cliente y producto con los nombres
    que espera el frontend (main.js).
    """
    visitas = Visita.query.order_by(Visita.fecha.desc()).all()
    return jsonify([{
        'id':           v.id,
        'fecha':        v.fecha.strftime('%d/%m/%Y %H:%M') if v.fecha else '—',
        'cliente':      v.cliente,
        'tipo_cliente': v.tipo_cliente or '—',   # ← campo que faltaba
        'producto':     v.producto_interes or '—', # ← nombre correcto para el JS
        'estado':       v.estado,
        'latitud':      v.latitud,
        'longitud':     v.longitud,
        'telefono':     v.telefono or '',
        'notas':        v.notas or '',
    } for v in visitas])

@app.route('/eliminar_visita/<int:id>', methods=['DELETE'])
@login_requerido
def eliminar_visita(id):
    v = Visita.query.get_or_404(id)
    db.session.delete(v)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/actualizar_estado/<int:id>', methods=['PUT'])
@login_requerido
def actualizar_estado(id):
    v        = Visita.query.get_or_404(id)
    v.estado = request.json.get('estado', v.estado)
    db.session.commit()
    return jsonify({'ok': True})

# ===== API ESTADISTICAS =====
@app.route('/api/stats')
@login_requerido
def api_stats():
    total      = Visita.query.count()
    cot        = Visita.query.filter_by(estado='Cotizacion').count()
    cierres    = Visita.query.filter_by(estado='Cliente').count()
    seguim     = Seguimiento.query.filter_by(completado=False).count()
    por_tipo   = db.session.query(Visita.tipo_cliente, db.func.count()).group_by(Visita.tipo_cliente).all()
    por_estado = db.session.query(Visita.estado, db.func.count()).group_by(Visita.estado).all()
    return jsonify({
        'total':        total,
        'cotizaciones': cot,
        'cierres':      cierres,
        'seguimientos': seguim,
        'por_tipo':     [{'tipo': t, 'n': n} for t, n in por_tipo],
        'por_estado':   [{'estado': e, 'n': n} for e, n in por_estado],
    })

# ===== API SEGUIMIENTOS =====
@app.route('/api/seguimientos', methods=['GET'])
@login_requerido
def get_seguimientos():
    segs = Seguimiento.query.filter_by(completado=False).order_by(Seguimiento.fecha).all()
    return jsonify([{
        'id':       s.id,
        'cliente':  s.cliente,
        'accion':   s.accion,
        'fecha':    s.fecha,
        'prioridad':s.prioridad,
    } for s in segs])

@app.route('/api/seguimientos', methods=['POST'])
@login_requerido
def crear_seguimiento():
    d = request.json
    s = Seguimiento(
        cliente   = d.get('cliente'),
        accion    = d.get('accion'),
        fecha     = d.get('fecha'),
        prioridad = d.get('prioridad', 'media'),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify({'ok': True, 'id': s.id})

@app.route('/api/seguimientos/<int:id>', methods=['DELETE'])
@login_requerido
def completar_seguimiento(id):
    s            = Seguimiento.query.get_or_404(id)
    s.completado = True
    db.session.commit()
    return jsonify({'ok': True})

# ===== API PRODUCTOS =====
@app.route('/api/productos')
@login_requerido
def get_productos():
    prods = Producto.query.all()
    return jsonify([{
        'id':          p.id,
        'nombre':      p.nombre,
        'categoria':   p.categoria,
        'descripcion': p.descripcion,
        'materiales':  p.materiales,
        'medidas':     p.medidas,
        'garantia':    p.garantia,
        'firmeza':     p.firmeza,
        'altura':      p.altura,
        'imagen':      p.imagen,
    } for p in prods])

# ===== API COTIZACIONES =====
@app.route('/api/cotizaciones', methods=['POST'])
@login_requerido
def crear_cotizacion():
    d = request.json
    c = Cotizacion(
        cliente   = d.get('cliente'),
        empresa   = d.get('empresa'),
        telefono  = d.get('telefono'),
        productos = json.dumps(d.get('productos', [])),
        total     = d.get('total', 0),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'ok': True, 'id': c.id})

# ===== API CHAT IA — Anthropic (sin CORS) =====
@app.route('/api/chat', methods=['POST'])
@login_requerido
def api_chat():
    """
    Proxy entre el frontend y la API de Anthropic.
    La ruta es /api/chat — que es exactamente lo que llama el main.js.
    Requiere variable de entorno: ANTHROPIC_API_KEY
    En Railway: Settings → Variables → Add ANTHROPIC_API_KEY = sk-ant-...
    """
    import urllib.request
    import urllib.error

    data    = request.json or {}
    mensaje = data.get('mensaje', '').strip()
    if not mensaje:
        return jsonify({'error': 'Mensaje vacio'}), 400

    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        return jsonify({'error': 'ANTHROPIC_API_KEY no configurada en las variables de entorno de Railway'}), 500

    system_prompt = """Eres el asistente de ventas de Espumados del Litoral, Barranquilla, Colombia.
Asistes a Candida Caballero, Asesora Institucional.

PORTAFOLIO 2026:
- Imperial Hotel Resortado: adaptable, 37cm, 6 capas, espuma flexible + resorte bonnel, garantia 5 anos.
- Imperial Hotel Firme: firme, 30cm, 3 capas, Extra Support + Perfect Support, garantia 5 anos.
- Colchoneta Antiescaras: firme, 13cm, Cuerotex/Ferrini, uso hospitalario.
- Almohada Confort M: adaptable, 14cm, Perfect Support + Sensafoam, garantia 6 meses.
- Almohada Confort S: adaptable, 12cm, Perfect Support, garantia 6 meses.
- Almohada Esencial M/S: adaptable, 10-12cm, Espuma, garantia 3 meses.
- Cojin TV Euro: firme, 43cm, Espuma, garantia 3 meses.

ESPUMAS POR DENSIDAD (precio por m3):
- D12: $180,000 — Tapiceria liviana, cojines decorativos.
- D18: $220,000 — Base de colchones, tapiceria suave.
- D23: $280,000 — Multiproposito, colchones economicos.
- D26: $320,000 — Colchones de calidad media.
- D30: $400,000 — Colchones institucionales, hoteles.
- D40: $520,000 — Industrial, medico, alta durabilidad.
9 colores disponibles: Blanco, Rosa, Gris, Gris Plata, Morada, Verde, Guayaba, Azul, Fucsia.

ESPONJAS: linea institucional para hoteles, clinicas y empresas de limpieza.

Responde siempre en espanol profesional y calido.
Cuando te pidan mensajes de WhatsApp o correos, redalctalos completos y listos para copiar.
Cuando te pregunten precios de espuma, calcula el volumen en m3 si te dan dimensiones (largo x ancho x alto / 1,000,000)."""

    payload = json.dumps({
        'model':      'claude-sonnet-4-20250514',
        'max_tokens': 1024,
        'system':     system_prompt,
        'messages':   [{'role': 'user', 'content': mensaje}],
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data    = payload,
        headers = {
            'Content-Type':      'application/json',
            'x-api-key':         api_key,
            'anthropic-version': '2023-06-01',
        },
        method = 'POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            texto  = result['content'][0]['text']
            return jsonify({'respuesta': texto})
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        return jsonify({'error': f'Anthropic error {e.code}: {error_body}'}), 502
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== WEBHOOK WHATSAPP (n8n) =====
@app.route('/whatsapp_lead', methods=['POST'])
def whatsapp_lead():
    data     = request.json
    telefono = data.get('telefono', '')
    mensaje  = data.get('mensaje', '')
    nombre   = data.get('nombre', telefono)

    existe = Visita.query.filter_by(telefono=telefono).first()
    if not existe:
        nueva = Visita(
            cliente          = nombre,
            tipo_cliente     = 'WhatsApp',
            producto_interes = data.get('producto', 'Por definir'),
            estado           = 'Prospecto',
            notas            = f'Primer mensaje: {mensaje}',
            telefono         = telefono,
        )
        db.session.add(nueva)
        seg = Seguimiento(
            cliente   = nombre,
            accion    = f'Cliente nuevo por WhatsApp — escribio: {mensaje}',
            fecha     = datetime.now().strftime('%Y-%m-%d'),
            prioridad = 'alta',
        )
        db.session.add(seg)
        db.session.commit()

    return jsonify({'ok': True, 'registrado': not bool(existe)})

# ===== EJECUCION =====
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        cargar_datos()
        crear_usuario_maestro()
        print('=' * 50)
        print('  CRM Litoral — Espumados del Litoral')
        print('  Usuario: candida_litoral')
        print('  Password: Litoral2026')
        print('=' * 50)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)