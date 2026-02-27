const mqtt = require('mqtt');
const env = require('../config/env');

let client = null;

function connect() {
  if (!env.MQTT_BROKER_URL) {
    console.log('[MQTT] No configurado - modo simulación');
    return;
  }

  const options = {};
  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
    options.password = env.MQTT_PASSWORD;
  }

  client = mqtt.connect(env.MQTT_BROKER_URL, options);

  client.on('connect', () => {
    console.log('[MQTT] Conectado al broker');
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconectando...');
  });
}

function publish(topic, message) {
  if (!client || !client.connected) {
    console.log(`[MQTT-SIM] ${topic}: ${message}`);
    return;
  }
  client.publish(topic, message, { qos: 1 });
}

function subscribe(topic, callback) {
  if (!client) return;
  client.subscribe(topic, { qos: 1 });
  client.on('message', (t, msg) => {
    if (t === topic) callback(JSON.parse(msg.toString()));
  });
}

module.exports = { connect, publish, subscribe };
