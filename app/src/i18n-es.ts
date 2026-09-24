// Spanish (Spain) for the interface. Keys are the English text; a test checks that every key used in the app
// is here (ADR 0023).
export const ES: Record<string, string> = {
  // General.
  'Something went wrong': 'Algo ha salido mal',
  Done: 'Hecho',
  Back: 'Atrás',
  Close: 'Cerrar',
  Next: 'Siguiente',
  Skip: 'Saltar',
  'Try again': 'Reintentar',
  Settings: 'Ajustes',
  Share: 'Compartir',
  Send: 'Enviar',
  Copy: 'Copiar',
  Delete: 'Borrar',
  About: 'Sobre qué',
  Who: 'Quiénes',
  Thinking: 'Pensando',
  ' and ': ' y ',
  'just now': 'ahora',
  '{n} min': '{n} min',
  Yesterday: 'Ayer',
  Two: 'Dos',
  Three: 'Tres',
  Four: 'Cuatro',
  Five: 'Cinco',
  Six: 'Seis',
  Seven: 'Siete',
  Eight: 'Ocho',
  Nine: 'Nueve',
  Ten: 'Diez',

  // Onboarding and first run.
  Welcome: 'Bienvenida',
  'The things in your home wake up.': 'Las cosas de tu casa despiertan.',
  'Point your phone at a lamp, a kettle or a door. It wakes up with a name, a personality and a voice of its own.':
    'Apunta con el móvil a una lámpara, una tetera o una puerta. Despierta con nombre, personalidad y voz propias.',
  'Talk to them. They remember.': 'Habla con ellas. Se acuerdan.',
  'Hold the button and speak, or type. They answer out loud, keep what you tell them, and know you when you come back.':
    'Mantén pulsado el botón y habla, o escribe. Te contestan en voz alta, guardan lo que les cuentas y te reconocen cuando vuelves.',
  'An experiment in AI on your device.': 'Un experimento de IA en tu dispositivo.',
  'Everything thinks inside your browser: a language model ({model}, through WebLLM and WebGPU) running on this device. No server, no account. It is early days: the first download is about {mb} MB, waking a thing takes about 20 seconds, and small models write better English than Spanish.':
    'Todo piensa dentro de tu navegador: un modelo de lenguaje ({model}, con WebLLM y WebGPU) que corre en este dispositivo. Sin servidor, sin cuentas. Es un experimento: la primera descarga ocupa unos {mb} MB, despertar algo tarda unos 20 segundos y los modelos pequeños escriben mejor en inglés que en español.',
  "Oh, you're back! Did Luna ever come home?": '¡Anda, has vuelto! ¿Al final volvió Luna?',
  'She did! She was under the stairs.': '¡Sí! Estaba debajo de la escalera.',
  '{n} of {total}': '{n} de {total}',
  Pages: 'Páginas',
  'Page {n}': 'Página {n}',
  "Let's begin": 'Empezar',
  'The things in your home are about to wake up.': 'Las cosas de tu casa están a punto de despertar.',
  'Point your phone at a lamp, a kettle or a door, and it will have a name, a voice and something to say.':
    'Apunta con el móvil a una lámpara, una tetera o una puerta, y tendrá nombre, voz y algo que contarte.',
  'This phone can run it': 'Este móvil puede con ello',
  'This device can run it': 'Este dispositivo puede con ello',
  'Souls and memories stay on this device': 'Las almas y sus recuerdos se quedan en este dispositivo',
  'This browser cannot listen, so you will type to them':
    'Este navegador no puede escuchar, así que les escribirás',
  'A one-time download of about {mb} MB. Use Wi-Fi.': 'Una única descarga de unos {mb} MB. Mejor con wifi.',
  'Teaching it to talk…': 'Enseñándole a hablar…',
  'Almost there…': 'Casi está…',
  '{done} of {total} MB': '{done} de {total} MB',
  Download: 'Descarga',
  'Keep this screen open. Next time it starts in a few seconds.':
    'Deja esta pantalla abierta. La próxima vez arranca en unos segundos.',
  'The download stopped: {message}. Check your connection, close other tabs, and try again.':
    'La descarga se ha parado: {message}. Revisa la conexión, cierra otras pestañas y vuelve a intentarlo.',
  'Downloading…': 'Descargando…',
  'Get started': 'Empezar',

  // The hearth.
  'Hearthwake closed suddenly last time, while it was trying to {what}. The phone probably ran out of memory: close other tabs and apps, then try again.':
    'La última vez Hearthwake se cerró de golpe mientras intentaba {what}. Seguramente al móvil le faltó memoria: cierra otras pestañas y apps y vuelve a probar.',
  'load the model': 'cargar el modelo',
  'create a soul': 'crear un alma',
  reply: 'contestar',
  'welcome back': 'darte la bienvenida',
  'Getting ready… {n}%': 'Preparándose… {n}%',
  'The voice of your things could not load ({message}).':
    'La voz de tus cosas no ha podido cargar ({message}).',
  "Who's awake": 'Quién está despierto',
  'All quiet': 'Todo en calma',
  'Nothing has woken up yet. Point your phone at something in your home: a lamp, a kettle, a door.':
    'Todavía no ha despertado nada. Apunta con el móvil a algo de tu casa: una lámpara, una tetera, una puerta.',
  'One thing in your home has something to say.': 'Una cosa de tu casa tiene algo que contarte.',
  '{n} things in your home have something to say.': '{n} cosas de tu casa tienen algo que contarte.',
  Play: 'Jugar',
  'Let them talk': 'Que hablen entre ellas',
  'Two things chat, out loud': 'Dos cosas charlan en voz alta',
  'Treasure hunt': 'Búsqueda del tesoro',
  'Solve a riddle, find the thing': 'Resuelve la adivinanza y encuéntrala',
  'Wake something': 'Despertar algo',
  'Describe it instead': 'Mejor descríbelo',

  // Waking.
  'Hearthwake is not allowed to use the camera. Allow it in your browser settings, or describe the thing instead.':
    'Hearthwake no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador o describe la cosa.',
  'The camera could not start. Close other apps that use it, or describe the thing instead.':
    'La cámara no ha podido arrancar. Cierra otras apps que la usen o describe la cosa.',
  'Camera view': 'Vista de la cámara',
  '{thing}?': '¿{label}?',
  'All on this device': 'Todo en este dispositivo',
  'Frame one thing and hold still': 'Encuadra una cosa y no te muevas',
  'Wake it': 'Despertarla',
  'Tap to wake it': 'Toca para despertarla',
  'Opening the camera…': 'Abriendo la cámara…',
  'Describe it': 'Descríbelo',
  'Tell Hearthwake what the thing is and what it looks like.': 'Cuéntale a Hearthwake qué es y cómo es.',
  'What is it?': '¿Qué es?',
  'a teapot': 'una tetera',
  'What does it look like?': '¿Cómo es?',
  'Round and blue, with a chipped spout.': 'Redonda y azul, con el pitorro desconchado.',
  'Waking up': 'Despertando',
  'Taking a good look': 'Mirándola bien',
  'What it is and what colour.': 'Qué es y de qué color.',
  'Finding its personality': 'Buscando su personalidad',
  'A name, a voice, a way of seeing things.': 'Un nombre, una voz, una forma de ver las cosas.',
  'Saying hello': 'Saludando',
  'Is this {name}?': '¿Es {name}?',
  'It looks a lot like {who}, who woke up here before.': 'Se parece mucho a {who}, que ya despertó aquí.',
  "Yes, it's {name}": 'Sí, es {name}',
  "No, it's someone new": 'No, es alguien nuevo',
  'It went back to sleep': 'Se ha vuelto a dormir',
  'Something stirs…': 'Algo se mueve…',
  'It takes about 20 seconds.': 'Tarda unos 20 segundos.',
  'Back home': 'Volver al inicio',
  'Everything happens on this device': 'Todo ocurre en este dispositivo',

  // Talking.
  '{name} had nothing to say. Try again.': '{name} no tenía nada que decir. Prueba otra vez.',
  'It could not answer': 'No ha podido contestar',
  "I didn't catch that. Hold the button while you speak.":
    'No te he oído bien. Mantén pulsado el botón mientras hablas.',
  'Listening back…': 'Escuchando…',
  '{name} is tidying its memories…': '{name} está ordenando sus recuerdos…',
  "Waking {name}'s voice… {n}%": 'Despertando la voz de {name}… {n}%',
  'Back to your hearth': 'Volver a tu hogar',
  'Speak replies aloud': 'Leer las respuestas en voz alta',
  Conversation: 'Conversación',
  'Woke up {date}': 'Despertó el {date}',
  '(say it again)': '(repetir)',
  '{name} is thinking': '{name} está pensando',
  'Listening…': 'Escuchando…',
  'Type instead': 'Escribir',
  'Listening… let go to send': 'Escuchando… suelta para enviar',
  'Hold to talk': 'Mantén para hablar',
  'Talk instead': 'Hablar',
  'Message to {name}': 'Mensaje para {name}',
  'Say something to {name}': 'Dile algo a {name}',
  'This browser cannot listen': 'Este navegador no puede escuchar',
  'Hearthwake is not allowed to listen. Allow the microphone in your browser settings.':
    'Hearthwake no tiene permiso para escuchar. Activa el micrófono en los ajustes del navegador.',
  'Could not hear you ({error})': 'No te he podido oír ({error})',

  // A soul's page.
  "{name}'s soul": 'El alma de {name}',
  "{name}'s card is in your downloads.": 'La tarjeta de {name} está en tus descargas.',
  'The card could not be made. Try again.': 'No se ha podido crear la tarjeta. Prueba otra vez.',
  Traits: 'Rasgos',
  'What it remembers': 'Lo que recuerda',
  'Nothing yet. After a few more chats, {name} starts keeping what matters.':
    'Nada todavía. Tras unas cuantas charlas más, {name} empezará a guardar lo importante.',
  'Nothing yet. {name} has only just woken up.': 'Nada todavía. {name} acaba de despertar.',
  'It looks like: {description}': 'Cómo es: {description}',
  'Talk to {name}': 'Hablar con {name}',
  'Let it sleep for good': 'Dejar que duerma para siempre',
  'Let {name} sleep for good?': '¿Dejar que {name} duerma para siempre?',
  'It will forget everything, and waking the same thing again makes someone new.':
    'Lo olvidará todo, y si vuelves a despertar la misma cosa será alguien nuevo.',
  'Let it sleep': 'Que duerma',
  'Keep {name}': 'Quedarme con {name}',
  'Woke up with Hearthwake': 'Despertó con Hearthwake',

  // Settings.
  Language: 'Idioma',
  'For the app, and for what your things say.': 'Para la app y para lo que dicen tus cosas.',
  Model: 'Modelo',
  'Bigger models write better, especially in Spanish, but need more memory and a new download.':
    'Los modelos más grandes escriben mejor, sobre todo en español, pero necesitan más memoria y otra descarga.',
  'about {mb} MB': 'unos {mb} MB',
  'Quick. Works on iPhone.': 'Rápido. Funciona en iPhone.',
  'Better Spanish. Needs more memory than most phones spare.':
    'Mejor español. Pide más memoria de la que suelen tener los móviles.',
  'Writes best. For computers.': 'El que mejor escribe. Para ordenadores.',
  '{model} downloads the next time Hearthwake starts.':
    '{model} se descargará la próxima vez que abras Hearthwake.',
  'Restart now': 'Reiniciar ahora',
  "With your device's voices. Off, replies are text only.":
    'Con las voces de tu dispositivo. Si lo apagas, las respuestas son solo texto.',
  'Downloaded models': 'Modelos descargados',
  'Space used is unknown.': 'No se sabe cuánto espacio ocupan.',
  'About {mb} MB used on this device.': 'Unos {mb} MB en este dispositivo.',
  'Delete the downloaded models? Your things keep their souls, and the models download again next time.':
    '¿Borrar los modelos descargados? Tus cosas conservan su alma y los modelos se volverán a descargar la próxima vez.',
  'Deleted {count} model caches. Reload the app to download them again.':
    'Borradas {count} cachés de modelos. Recarga la app para volver a descargarlos.',
  Diagnostics: 'Diagnóstico',
  'Timings and events from this visit, to report a problem.':
    'Tiempos y eventos de esta visita, para informar de un problema.',
  'Diagnostics copied. Paste them wherever you need them.': 'Diagnóstico copiado. Pégalo donde lo necesites.',
  'The clipboard is not available here.': 'Aquí no se puede usar el portapapeles.',
  "Hearthwake {version}. The AI runs on this device. Speech recognition is your browser's, which may use its maker's servers.":
    'Hearthwake {version}. La IA corre en este dispositivo. El reconocimiento de voz es el de tu navegador, que puede usar los servidores de su fabricante.',
  'About this experiment': 'Sobre este experimento',
  'What Hearthwake is and how it works.': 'Qué es Hearthwake y cómo funciona.',
  'Test harness': 'Banco de pruebas',
  'The M0 feasibility spike, to measure models one by one.':
    'El prototipo del M0, para medir los modelos uno a uno.',

  // Play.
  'Pick two things and a topic, and listen to them chat.':
    'Elige dos cosas y un tema, y escucha cómo charlan.',
  'Their conversation': 'Su conversación',
  'who is the most useful': 'quién es más útil',
  'the best spot in the house': 'el mejor sitio de la casa',
  'what the family did today': 'qué ha hecho hoy la familia',
  'a secret': 'un secreto',
  'Stop them': 'Pararlas',
  'Let {a} and {b} talk': 'Que hablen {a} y {b}',
  'Pick two things': 'Elige dos cosas',
  'They fell silent': 'Se han quedado calladas',
  'One of your things hides, another gives you a riddle. Find the hidden thing and point your camera at it. {n} rounds.':
    'Una de tus cosas se esconde y otra te pone una adivinanza. Encuentra la escondida y apúntala con la cámara. {n} rondas.',
  'Start the hunt': 'Empezar la búsqueda',
  'Wake two things first, one with the camera': 'Primero despierta dos cosas, una con la cámara',
  'Wake at least two things, one with the camera.': 'Despierta al menos dos cosas, una con la cámara.',
  'The clue got lost': 'La pista se ha perdido',
  'It was me, {name}!': '¡Era yo, {name}!',
  "You found me! I'm {name}!": '¡Me has encontrado! ¡Soy {name}!',
  'It was {name}!': '¡Era {name}!',
  'You found {name}!': '¡Has encontrado a {name}!',
  'See the score': 'Ver la puntuación',
  'Next riddle': 'Siguiente adivinanza',
  'A perfect hunt!': '¡Búsqueda perfecta!',
  'Well hunted!': '¡Bien buscado!',
  'They hid well this time.': 'Esta vez se escondieron bien.',
  'Play again': 'Jugar otra vez',
  'The camera could not start. Allow it in your browser settings.':
    'La cámara no ha podido arrancar. Actívala en los ajustes del navegador.',
  'Give up': 'Rendirse',
  'Find it and point the camera at it.': 'Encuéntrala y apúntala con la cámara.',
  'Hint given': 'Pista dada',
  'Give me a hint': 'Dame una pista',
  'I give up': 'Me rindo',

  // Unsupported browsers.
  "This browser can't wake things up yet.": 'Este navegador todavía no puede despertar cosas.',
  'Hearthwake runs its AI on your device, and that needs WebGPU, which this browser does not offer.':
    'Hearthwake ejecuta su IA en tu dispositivo, y eso necesita WebGPU, que este navegador no tiene.',
  'On iPhone or iPad: Safari or Chrome, on iOS 26 or later.':
    'En iPhone o iPad: Safari o Chrome, con iOS 26 o posterior.',
  'On a computer: Chrome or Edge.': 'En un ordenador: Chrome o Edge.',
  'On Android: Chrome, on a recent phone.': 'En Android: Chrome, en un móvil reciente.',
  'Curious what works here? The test harness checks each part on its own.':
    '¿Quieres ver qué funciona aquí? El banco de pruebas comprueba cada parte por separado.',
  'Open the test harness': 'Abrir el banco de pruebas',
};
