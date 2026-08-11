# TestSimulator

App de escritorio para **simular respuestas de backends** durante tus pruebas locales. Levanta múltiples simulaciones simultáneas, tanto **Web Services (HTTP/JSON/SOAP)** como **colas de mensajes (MQ vía STOMP / ActiveMQ)**, cada una con respuestas configurables y **matching condicional** sobre el contenido del request.

Se instala como una **aplicación nativa de macOS** (ventana propia, ícono en el Dock) y trae un **panel web** para administrar los mocks: crearlos, editarlos, iniciarlos/detenerlos, copiar la URL para pegarla en Postman y ver los logs.

## Características

- **WS Simulator**: expone endpoints HTTP locales que responden con JSON, XML, SOAP o texto.
- **MQ Simulator**: escucha una cola de entrada y responde en una cola de salida (o en la `reply-to` del mensaje), preservando el `correlation-id`.
- **Matching condicional**: reglas por campo JSON, XPath (XML/SOAP) o regex, con composición `and`/`or`.
- **Templates con variables**: respuestas con placeholders `{{var}}` y built-ins `{{$timestamp}}`, `{{$uuid}}`, `{{$random}}`.
- **Panel de administración** en `http://localhost:3000/` (crear/editar/iniciar/detener, copiar URL, logs).
- **Múltiples instancias** corriendo a la vez, cada WS en su propio puerto.

## Requisitos

- **macOS** con las **Command Line Tools de Xcode** (proveen `swiftc`). Instalá con: `xcode-select --install`
- **Node.js 20+** (`node -v` para verificar).
- Para simulaciones **MQ**: un broker que hable **STOMP** (p.ej. ActiveMQ). Arranque rápido con Docker:
  ```bash
  docker run -d --name activemq -p 61613:61613 -p 8161:8161 apache/activemq-classic
  ```
  El puerto STOMP por defecto es `61613`.

## Descargar e instalar

```bash
# 1. Clonar el repositorio
git clone https://github.com/marcelo-tallone/TestSimulator.git
cd TestSimulator

# 2. Instalar como app de escritorio en /Applications
./install-macos.sh
```

El instalador: instala dependencias (`npm install`), compila el servidor (TypeScript), genera el ícono, compila el wrapper nativo en Swift y crea **`/Applications/TestSimulator.app`**.

Después:

1. Abrí la app desde **Launchpad** o **Finder → Aplicaciones** (o `open -a TestSimulator`).
2. Se abre en su **propia ventana** con el panel de administración.
3. Para fijarla al Dock: **click derecho en el ícono del Dock → Opciones → Mantener en el Dock**.
4. Para cerrarla: **Cmd+Q** o cerrá la ventana (apaga el servidor y libera los puertos).

Al abrir, la app levanta el servidor como proceso hijo; al cerrar, lo apaga. Logs en `~/Library/Logs/TestSimulator.log`.

> La app apunta a la carpeta del proyecto donde corriste el instalador. Si movés el proyecto, volvé a ejecutar `./install-macos.sh`.

**Desinstalar:** `./uninstall-macos.sh`

### Alternativa: correr sin instalar (modo desarrollo)

```bash
npm install
npm run dev          # auto-reload con tsx; panel en http://localhost:3000/
# o para build de producción:
npm run build && npm start
```

## Uso (panel web)

Con la app abierta (o el server corriendo), en `http://localhost:3000/`:

1. **+ Nueva simulación** → poné un nombre, elegí tipo (WS/MQ), **puerto** y **ruta**, y **pegá el JSON** que querés que devuelva en el campo *Respuesta*. Click en **Crear**.
2. **Iniciar** la simulación desde su fila. Queda escuchando en el puerto/ruta configurados.
3. **Copiar la URL** con el botón 📋 de la columna *URL / Cola* y pegala en **Postman**, `curl`, etc.
4. **Editar** (✎) para modificar cualquier campo; si estaba corriendo, se reinicia sola para aplicar los cambios.
5. **Logs** para ver los requests recibidos y qué respondió cada uno.

Para casos avanzados (reglas de matching, variables, templates), usá el desplegable **"Avanzado: pegar la definición JSON completa"** dentro del diálogo de creación (ver formato más abajo).

## Uso por API (opcional)

Todo lo del panel está disponible por REST. Ejemplos:

```bash
# Crear una simulación WS
curl -X POST http://localhost:3000/api/simulations \
  -H 'Content-Type: application/json' \
  -d @simulations/examples/mock-api-cuentas.json
# -> devuelve el "id"

# Iniciarla e invocarla
curl -X POST http://localhost:3000/api/simulations/<id>/start
curl http://localhost:3002/v1/cuentas/by-numero/0000001

# Ver los logs
curl http://localhost:3000/api/simulations/<id>/logs
```

Para **MQ**: levantá ActiveMQ (ver Requisitos), creá el mock con la config de `simulations/examples/mock-ace-transferencias.json`, iniciálo, y poné un mensaje en la cola de entrada (con header `reply-to` y `correlation-id`). El simulador responde en la cola indicada preservando el `correlation-id`.

## Formato de una simulación

```jsonc
{
  "name": "Mock API Cuentas",
  "type": "ws",                       // "ws" | "mq"
  "ws": {                             // config si type=ws
    "port": 3002,
    "path": "/v1/cuentas/by-numero/:numeroCuenta",
    "method": "GET",                  // GET|POST|PUT|DELETE|PATCH|ANY
    "responseFormat": "json",         // json|xml|soap|text
    "defaultStatusCode": 200,
    "defaultDelay": 0                 // latencia simulada en ms
  },
  "rules": [                          // evaluadas por priority ascendente
    {
      "name": "Cuenta activa",
      "priority": 1,
      "condition": { "type": "regex", "field": "path", "pattern": "0000001" },
      "response": { "templateFile": "examples/cuenta-activa-ars.json", "statusCode": 200 }
    }
  ],
  "defaultResponse": {                // cuando ninguna regla matchea
    "inlineBody": { "estado": "ACTIVA" },
    "statusCode": 200
  }
}
```

Para **MQ**, en vez de `ws` se usa:

```jsonc
"mq": {
  "host": "localhost", "port": 61613,
  "inputQueue": "REQUEST.QUEUE", "outputQueue": "RESPONSE.QUEUE",
  "useReplyToQueue": true, "preserveCorrelId": true,
  "responseFormat": "json"
}
```

### Tipos de condición (`condition.type`)

| type | campos | ejemplo |
|------|--------|---------|
| `json-field` | `field` (dot-notation), `operator`, `value` | `{ "type":"json-field","field":"monto","operator":"lt","value":10000 }` |
| `xpath` | `expression` | `{ "type":"xpath","expression":"//AccountNumber[text()='12345']" }` |
| `regex` | `pattern`, `flags`, `field` (`path` o body) | `{ "type":"regex","field":"path","pattern":"by-numero/0000001" }` |
| `always` | — | siempre matchea (útil con `and`/`or`) |

Operadores json-field: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `exists`.
Composición: `condition.and: [...]` (todas) o `condition.or: [...]` (alguna).

### Respuestas con variables

`response.variables` extrae valores del request para inyectarlos en el template:

```jsonc
"response": {
  "templateFile": "examples/mq-transfer-ok.json",
  "variables": [
    { "name": "requestId", "source": "json-field", "path": "requestId" },
    { "name": "monto", "source": "json-field", "path": "monto" }
  ]
}
```

Fuentes (`source`): `json-field`, `header`, `query`, `fixed`.
Built-ins disponibles siempre: `{{$timestamp}}`, `{{$uuid}}`, `{{$random}}`, `{{$date}}`.

## Admin API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Resumen (running/stopped/error) |
| GET | `/api/simulations` | Listar |
| POST | `/api/simulations` | Crear |
| GET | `/api/simulations/:id` | Detalle |
| PUT | `/api/simulations/:id` | Actualizar |
| DELETE | `/api/simulations/:id` | Eliminar (debe estar detenida) |
| POST | `/api/simulations/:id/start` | Iniciar |
| POST | `/api/simulations/:id/stop` | Detener |
| POST | `/api/simulations/:id/restart` | Reiniciar |
| GET | `/api/simulations/:id/logs?limit=N` | Logs de requests |
| DELETE | `/api/simulations/:id/logs` | Limpiar logs |
| GET | `/api/logs?limit=N` | Logs de todas las simulaciones |
| GET | `/api/templates` | Listar templates |
| GET/PUT/DELETE | `/api/templates/:path` | Leer/guardar/borrar template |
| GET | `/api/simulations/export` | Exportar todas las configs |
| POST | `/api/simulations/import` | Importar configs (array u objeto) |
| POST | `/api/start-all` \| `/api/stop-all` | Iniciar/detener todas |

Las simulaciones se persisten en `simulations/simulations.json` (siempre como `stopped`; se inician manualmente).

## Configuración por entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ADMIN_PORT` | `3000` | Puerto de la Admin API / panel |
| `TEMPLATES_DIR` | `./templates` | Directorio de templates |
| `SIMULATIONS_DIR` | `./simulations` | Directorio de configs persistidas |
| `MAX_LOGS` | `1000` | Máximo de logs en memoria por simulación |
| `LOG_LEVEL` | `info` | Nivel de log (pino) |

## Tests

```bash
npm test
```

## Notas sobre MQ

La conectividad MQ usa **STOMP** (`stompit`), que funciona nativo con **ActiveMQ** y no requiere librerías nativas — ideal para pruebas locales. IBM MQ también expone STOMP; alternativamente puede agregarse el cliente `ibmmq` implementando la misma interfaz `StompMqClient` en `src/simulators/mq/`.

## Estructura del proyecto

```
TestSimulator/
├── src/                    # Servidor TypeScript (admin API, simuladores WS/MQ, matching)
├── public/                 # Panel web (dashboard)
├── macos/                  # Wrapper de la app nativa (Swift + WKWebView)
├── templates/examples/     # Templates de respuesta de ejemplo
├── simulations/examples/   # Definiciones de simulación de ejemplo
├── assets/make-icon.mjs    # Generador del ícono de la app
├── install-macos.sh        # Instalador de la app de escritorio
└── uninstall-macos.sh      # Desinstalador
```
