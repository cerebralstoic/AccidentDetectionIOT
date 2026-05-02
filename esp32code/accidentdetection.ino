#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <MPU6050.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/RTDBHelper.h>
#include "secrets.h"



#define BUZZER     27
#define LED        26
#define VIB_SENSOR 34



#define BUZZER_ENABLED 0

//Set 0 for real gps module
#define USE_REAL_GPS 0

// Cloud 
const unsigned long LIVE_PUSH_INTERVAL_MS      = 1000;   // live refreshes every 1s
const unsigned long TELEMETRY_PUSH_INTERVAL_MS = 30000;  // this 30s delay to add history
unsigned long lastLivePushMs      = 0;
unsigned long lastTelemetryPushMs = 0;

FirebaseData   fbData;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;
bool firebaseReady = false;


LiquidCrystal_I2C lcd(0x27, 16, 2);
MPU6050 mpu(0x68);


bool accident = false;
bool rollover = false;


//Roll over threshold
const float ROLLOVER_TILT_DEG       = 75.0;
const float ROLLOVER_GYRO_DEG_S     = 200.0;
const float ROLLOVER_PRE_TILT_DEG   = 45.0;
const float ROLLOVER_PRE_GYRO_DEG_S = 70.0;
const int   ROLLOVER_CONFIRM_COUNT  = 3;


int rolloverHitCount = 0;


unsigned long lastVibrationTime = 0;
const unsigned long VIB_WINDOW_MS = 500;


// fake mock gps 
const float SIMULATED_LAT = 30.316494;
const float SIMULATED_LON = 78.032191;


// for real gps
void getGPSCoordinates(float &lat, float &lon, bool &isReal) {
#if USE_REAL_GPS
  // TODO: read from TinyGPS++ on Serial2; fall back to simulated until valid fix.
  lat    = SIMULATED_LAT;
  lon    = SIMULATED_LON;
  isReal = false;
#else
  lat    = SIMULATED_LAT;
  lon    = SIMULATED_LON;
  isReal = false;
#endif
}


//for the cloud setup using firebase
void setupCloud() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  lcd.clear();
  lcdPrint(0, 0, "WiFi connect..");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi FAILED. Continuing offline.");
    lcdPrint(0, 1, "WiFi: OFFLINE  ");
    delay(1500);
    firebaseReady = false;
    return;
  }

  Serial.print("Wi-Fi OK. IP: ");
  Serial.println(WiFi.localIP());
  lcdPrint(0, 1, "WiFi: OK       ");
  delay(800);

  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.reconnectWiFi(true);
  Firebase.begin(&fbConfig, &fbAuth);

  firebaseReady = Firebase.ready();
  Serial.println(firebaseReady ? "Firebase READY" : "Firebase init pending");
  lcdPrint(0, 0, "Cloud: ready   ");
  lcdPrint(0, 1, "               ");
  delay(800);
}


static void buildSnapshot(FirebaseJson &json,
                          float ax, float ay, float az,
                          float gx, float gy, float gz,
                          float tiltDeg, float netAccel,
                          bool vibrationConfirmed) {
  float lat, lon; bool isReal;
  getGPSCoordinates(lat, lon, isReal);

  json.clear();
  json.set("deviceId", DEVICE_ID);
  json.set("ax", ax); json.set("ay", ay); json.set("az", az);
  json.set("gx", gx); json.set("gy", gy); json.set("gz", gz);
  json.set("tiltDeg", tiltDeg);
  json.set("netAccel", netAccel);
  json.set("vibrationState", vibrationConfirmed ? 1 : 0);
  json.set("latitude", lat);
  json.set("longitude", lon);
  json.set("gpsReal", isReal);
  json.set("timestamp/.sv", "timestamp"); // server-side timestamp
}


// Live state overwrites nodes every 1 sec
void pushLive(float ax, float ay, float az,
              float gx, float gy, float gz,
              float tiltDeg, float netAccel,
              bool vibrationConfirmed) {
  if (!firebaseReady && !(firebaseReady = Firebase.ready())) return;

  FirebaseJson json;
  buildSnapshot(json, ax, ay, az, gx, gy, gz,
                tiltDeg, netAccel, vibrationConfirmed);
  String path = String("/devices/") + DEVICE_ID + "/live";
  if (!Firebase.RTDB.setJSON(&fbData, path.c_str(), &json)) {
    Serial.print("pushLive failed: ");
    Serial.println(fbData.errorReason());
  }
}


// Telementary history adds every 30 sec
void pushTelemetry(float ax, float ay, float az,
                   float gx, float gy, float gz,
                   float tiltDeg, float netAccel,
                   bool vibrationConfirmed) {
  if (!firebaseReady && !(firebaseReady = Firebase.ready())) return;

  FirebaseJson json;
  buildSnapshot(json, ax, ay, az, gx, gy, gz,
                tiltDeg, netAccel, vibrationConfirmed);
  String path = String("/devices/") + DEVICE_ID + "/telemetry";
  if (!Firebase.RTDB.pushJSON(&fbData, path.c_str(), &json)) {
    Serial.print("pushTelemetry failed: ");
    Serial.println(fbData.errorReason());
  }
}


// Accident event after beign confirmed
void pushEvent(const String &eventType, const String &severity,
               float ax, float ay, float az,
               float gx, float gy, float gz,
               float tiltDeg, float netAccel,
               bool vibrationConfirmed) {
  if (!firebaseReady && !(firebaseReady = Firebase.ready())) {
    Serial.println("Firebase not ready, event NOT pushed");
    return;
  }

  float lat, lon; bool isReal;
  getGPSCoordinates(lat, lon, isReal);

  FirebaseJson json;
  json.set("eventType", eventType);
  json.set("severity", severity);
  json.set("deviceId", DEVICE_ID);
  json.set("ax", ax); json.set("ay", ay); json.set("az", az);
  json.set("gx", gx); json.set("gy", gy); json.set("gz", gz);
  json.set("tiltDeg", tiltDeg);
  json.set("netAccel", netAccel);
  json.set("vibrationState", vibrationConfirmed ? 1 : 0);
  json.set("latitude", lat);
  json.set("longitude", lon);
  json.set("gpsReal", isReal);
  json.set("timestamp/.sv", "timestamp");

  // For owner of the device
  String privatePath = String("/devices/") + DEVICE_ID + "/events";
  if (Firebase.RTDB.pushJSON(&fbData, privatePath.c_str(), &json)) {
    Serial.print("Event pushed (private): ");
    Serial.println(fbData.dataPath() + "/" + fbData.pushName());
  } else {
    Serial.print("pushEvent (private) failed: ");
    Serial.println(fbData.errorReason());
  }

  // For the public users for seeing the events occured
  FirebaseJson pubJson;
  pubJson.set("eventType", eventType);
  pubJson.set("severity",  severity);
  pubJson.set("deviceId",  DEVICE_ID);
  pubJson.set("latitude",  lat);
  pubJson.set("longitude", lon);
  pubJson.set("tiltDeg",   tiltDeg);
  pubJson.set("netAccel",  netAccel);
  pubJson.set("gpsReal",   isReal);
  pubJson.set("timestamp/.sv", "timestamp");

  if (!Firebase.RTDB.pushJSON(&fbData, "/public/incidents", &pubJson)) {
    Serial.print("pushEvent (public) failed: ");
    Serial.println(fbData.errorReason());
  }
}


bool buzzerToneActive = false;

void startBuzzerTone(unsigned int freq) {
#if BUZZER_ENABLED
  tone(BUZZER, freq);
  buzzerToneActive = true;
#else
  (void)freq;
#endif
}

void silenceBuzzer() {
#if BUZZER_ENABLED
  if (buzzerToneActive) {
    noTone(BUZZER);
    ledcDetachPin(BUZZER);
    buzzerToneActive = false;
  }
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
#endif
}


void triggerGPSAlert(String alertType) {
  float lat, lon;
  bool  isReal;
  getGPSCoordinates(lat, lon, isReal);

  Serial.println();
  Serial.println("==================================");
  Serial.print("ALERT TYPE: ");
  Serial.println(alertType);
  Serial.println(">>> DISPATCHING EMERGENCY SOS <<<");
  Serial.print("GPS Source: ");
  Serial.println(isReal ? "REAL (NEO-6M)" : "MOCK (no module)");
  Serial.print("Location: https://maps.google.com/?q=");
  Serial.print(lat, 6);
  Serial.print(",");
  Serial.println(lon, 6);
  Serial.println("==================================");
  Serial.println();
}


void lcdPrint(int col, int row, String msg) {
  lcd.setCursor(col, row);
  while (msg.length() < 16) msg += ' ';
  lcd.print(msg.substring(0, 16));
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Boot started...");


#if BUZZER_ENABLED
  pinMode(BUZZER, OUTPUT);
#else
  
  pinMode(BUZZER, INPUT);
#endif
  pinMode(LED,        OUTPUT);
  pinMode(VIB_SENSOR, INPUT);

  silenceBuzzer();
  digitalWrite(LED, LOW);


  Wire.begin(21, 22);
  Serial.println("I2C started...");


  lcd.init();
  lcd.backlight();
  Serial.println("LCD initialized...");

  Wire.beginTransmission(0x68);
  Wire.write(0x6B); 
  Wire.write(0x00); //for waking up
  byte err = Wire.endTransmission();


  if (err != 0) {
    Serial.print("MPU6050 wake FAILED! I2C error: ");
    Serial.println(err);
    lcd.clear();
    lcdPrint(0, 0, "MPU6050 Error!");
    lcdPrint(0, 1, "Check wiring.");
    while (1) delay(1000);
  }


  Serial.println("MPU6050 woken up via raw I2C!");


  mpu.initialize();



  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_8);
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);


  Serial.println("MPU6050 configured!");

  setupCloud();

  Serial.println("System Ready!");


  lcd.clear();
  lcdPrint(0, 0, "System Ready");
  delay(2000);
  lcd.clear();
}



void loop() {
  accident = false;


  // 1. Vibration Sensor
  if (digitalRead(VIB_SENSOR) == HIGH) {
    lastVibrationTime = millis();
  }
  bool vibrationConfirmed = (millis() - lastVibrationTime) <= VIB_WINDOW_MS;


  // 2. Read MPU6050 directly via raw I2C (bypasses library WHO_AM_I checks)
  Wire.beginTransmission(0x68);
  Wire.write(0x3B); // Start at ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(0x68, 14); // Read accel + temp + gyro = 14 bytes


  int16_t rawAX, rawAY, rawAZ;
  int16_t rawGX, rawGY, rawGZ;


  if (Wire.available() == 14) {
    rawAX = (Wire.read() << 8) | Wire.read();
    rawAY = (Wire.read() << 8) | Wire.read();
    rawAZ = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read(); // Skip temperature (2 bytes)
    rawGX = (Wire.read() << 8) | Wire.read();
    rawGY = (Wire.read() << 8) | Wire.read();
    rawGZ = (Wire.read() << 8) | Wire.read();
  } else {
    Serial.println("I2C read failed! Skipping loop.");
    delay(200);
    return;
  }


  // 3. Convert to real units
  // Accel ±8g → 4096 LSB/g → m/s²
  float ax = (rawAX / 4096.0) * 9.81;
  float ay = (rawAY / 4096.0) * 9.81;
  float az = (rawAZ / 4096.0) * 9.81;


  // Gyro ±500 deg/s → 65.5 LSB/deg/s
  float gx = rawGX / 65.5;
  float gy = rawGY / 65.5;
  float gz = rawGZ / 65.5;


  // 4. Tilt and dominant gyro
  float tiltDeg = atan2(sqrt(ax * ax + ay * ay), az) * 57.2958;
  float gyroXY  = fabs(gx) > fabs(gy) ? fabs(gx) : fabs(gy);

  // Net acceleration magnitude (gravity removed). At rest this is ~0
  // regardless of how the board is mounted, so impact thresholds aren't
  // sensitive to orientation. A real crash spikes this well above 0.
  float accelMag = sqrt(ax * ax + ay * ay + az * az);
  float netAccel = fabs(accelMag - 9.81);


  // Debug
  Serial.print("Acc(m/s2): ");
  Serial.print(ax, 2); Serial.print(", ");
  Serial.print(ay, 2); Serial.print(", ");
  Serial.print(az, 2);
  Serial.print(" | Net: ");
  Serial.print(netAccel, 2);
  Serial.print(" | Gyro(deg/s): ");
  Serial.print(gx, 1); Serial.print(", ");
  Serial.print(gy, 1); Serial.print(", ");
  Serial.print(gz, 1);
  Serial.print(" | Tilt: ");
  Serial.print(tiltDeg, 1);
  Serial.print(" | Vib: ");
  Serial.println(vibrationConfirmed ? "YES" : "NO");


  // 5. Impact Detection — based on net acceleration (gravity-independent).
  // Thresholds in m/s² over and above 1g baseline. Tune on real hardware.
  String level = "NORMAL";
  bool impactSpike = false;

  if (netAccel > 20.0) {
    level = "SEVERE";
    impactSpike = true;
  } else if (netAccel > 12.0) {
    level = "MODERATE";
    impactSpike = true;
  } else if (netAccel > 7.0) {
    level = "MINOR";
    impactSpike = true;
  }


  // Require BOTH a real accel spike AND vibration confirmation. SW-420
  // modules often false-trigger, so we keep it as a secondary check only.
  if (impactSpike && vibrationConfirmed) {
    accident = true;
  }


  // 6. Rollover Detection
  bool rolloverCandidate =
    (tiltDeg > ROLLOVER_TILT_DEG   && gyroXY > ROLLOVER_PRE_GYRO_DEG_S) ||
    (gyroXY  > ROLLOVER_GYRO_DEG_S && tiltDeg > ROLLOVER_PRE_TILT_DEG);


  if (rolloverCandidate) {
    if (rolloverHitCount < ROLLOVER_CONFIRM_COUNT) rolloverHitCount++;
  } else {
    rolloverHitCount = 0;
  }


  rollover = (rolloverHitCount >= ROLLOVER_CONFIRM_COUNT);
  if (rollover) accident = true;


//Output


  if (rollover) {
    triggerGPSAlert("ROLLOVER DETECTED");
    pushEvent("rollover", "severe",
              ax, ay, az, gx, gy, gz,
              tiltDeg, netAccel, vibrationConfirmed);


    // Frame 1: Banner
    lcd.clear();
    lcdPrint(0, 0, "ACCIDENT!");
    lcdPrint(0, 1, "ROLL OVER");
    startBuzzerTone(2000);
    digitalWrite(LED, HIGH);
    delay(1200);


    // Frame 2: Tilt + GyroXY + AX/AY
    lcd.clear();
    {
      String line0 = "T:"; line0 += String(tiltDeg, 1);
      line0 += " G:";      line0 += String(gyroXY, 1);
      lcdPrint(0, 0, line0);
    }
    {
      String line1 = "AX:"; line1 += String(ax, 1);
      line1 += " AY:";      line1 += String(ay, 1);
      lcdPrint(0, 1, line1);
    }
    delay(1500);


    // Frame 3: GX GY GZ
    lcd.clear();
    {
      String line0 = "GX:"; line0 += String(gx, 1);
      line0 += " GY:";      line0 += String(gy, 1);
      lcdPrint(0, 0, line0);
    }
    {
      String line1 = "GZ:"; line1 += String(gz, 1);
      lcdPrint(0, 1, line1);
    }
    delay(1500);


    silenceBuzzer();
    digitalWrite(LED, LOW);


    rolloverHitCount  = 0;
    rollover          = false;
    accident          = false;
    lastVibrationTime = 0;
    lcd.clear();
  }


  else if (accident) {
    triggerGPSAlert(level + " IMPACT");
    {
      String sev = level; sev.toLowerCase();
      pushEvent("accident", sev,
                ax, ay, az, gx, gy, gz,
                tiltDeg, netAccel, vibrationConfirmed);
    }


    lcd.clear();
    lcdPrint(0, 0, "ACCIDENT!");
    lcdPrint(0, 1, level);


    if      (level == "SEVERE")   startBuzzerTone(2000);
    else if (level == "MODERATE") startBuzzerTone(1200);
    else                          startBuzzerTone(800);


    digitalWrite(LED, HIGH);
    delay(3000);
    silenceBuzzer();
    digitalWrite(LED, LOW);


    accident          = false;
    lastVibrationTime = 0;
    lcd.clear();
  }


  else {

    silenceBuzzer();
    if (rolloverHitCount > 0) {
      lcdPrint(0, 0, "ROLL CHECK...");
      String line1 = "T"; line1 += String(tiltDeg, 0);
      line1 += " G";      line1 += String(gyroXY, 1);
      lcdPrint(0, 1, line1);
    } else {
      lcdPrint(0, 0, "No Accident");
      lcdPrint(0, 1, "Monitoring...");
    }
  }


  // For continuous on device detection even the device goes offline,
  unsigned long now = millis();
  if (now - lastLivePushMs >= LIVE_PUSH_INTERVAL_MS) {
    lastLivePushMs = now;
    pushLive(ax, ay, az, gx, gy, gz, tiltDeg, netAccel, vibrationConfirmed);
  }
  if (now - lastTelemetryPushMs >= TELEMETRY_PUSH_INTERVAL_MS) {
    lastTelemetryPushMs = now;
    pushTelemetry(ax, ay, az, gx, gy, gz, tiltDeg, netAccel, vibrationConfirmed);
  }


  delay(200);
}

