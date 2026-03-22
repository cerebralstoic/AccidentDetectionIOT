#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#define BUZZER 25
#define LED 26

LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_MPU6050 mpu;

bool accident = false;
bool rollover = false;

const float ROLLOVER_TILT_DEG = 75.0;
const float ROLLOVER_GYRO_RAD_S = 3.5;
const float ROLLOVER_PRE_TILT_DEG = 45.0;
const float ROLLOVER_PRE_GYRO_RAD_S = 1.2;
const int ROLLOVER_CONFIRM_COUNT = 3;

int rolloverHitCount = 0;

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER, OUTPUT);
  pinMode(LED, OUTPUT);

  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();

  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
    while (1);
  }

  lcd.setCursor(0, 0);
  lcd.print("System Ready");
  delay(2000);
  lcd.clear();
}

void loop() {
  accident = false;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float ax = a.acceleration.x;
  float ay = a.acceleration.y;
  float az = a.acceleration.z;

  float gx = g.gyro.x;
  float gy = g.gyro.y;
  float gz = g.gyro.z;

  float tiltDeg = atan2(sqrt(ax * ax + ay * ay), az) * 57.2958;
  float gyroXY = fabs(gx) > fabs(gy) ? fabs(gx) : fabs(gy);

  Serial.print("Acc: ");
  Serial.print(ax); Serial.print(", ");
  Serial.print(ay); Serial.print(", ");
  Serial.print(az);

  Serial.print(" | Gyro: ");
  Serial.print(gx); Serial.print(", ");
  Serial.print(gy); Serial.print(", ");
  Serial.println(gz);

  String level = "NORMAL";


  if (fabs(ax) > 20 || fabs(ay) > 20 || fabs(az) > 25) {
    level = "SEVERE";
    accident = true;
  } 
  else if (fabs(ax) > 15 || fabs(ay) > 15) {
    level = "MODERATE";
    accident = true;
  } 
  else if (fabs(ax) > 10 || fabs(ay) > 10) {
    level = "MINOR";
    accident = true;
  }

  bool rolloverCandidate =
    (tiltDeg > ROLLOVER_TILT_DEG && gyroXY > ROLLOVER_PRE_GYRO_RAD_S) ||
    (gyroXY > ROLLOVER_GYRO_RAD_S && tiltDeg > ROLLOVER_PRE_TILT_DEG);

  if (rolloverCandidate) {
    if (rolloverHitCount < ROLLOVER_CONFIRM_COUNT) {
      rolloverHitCount++;
    }
  } else {
    rolloverHitCount = 0;
  }

  rollover = rolloverHitCount >= ROLLOVER_CONFIRM_COUNT;
  if (rollover) {
    accident = true;
  }

  if (rollover) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ACCIDENT!");
    lcd.setCursor(0, 1);
    lcd.print("ROLL OVER");

    Serial.print("ACCIDENT: ROLL OVER | T:");
    Serial.print(tiltDeg, 1);
    Serial.print(" GXY:");
    Serial.println(gyroXY, 2);

    delay(1200);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("T:");
    lcd.print(tiltDeg, 1);
    lcd.print(" G:");
    lcd.print(gyroXY, 1);
    lcd.setCursor(0, 1);
    lcd.print("AX:");
    lcd.print(ax, 1);
    lcd.print(" AY:");
    lcd.print(ay, 1);

    delay(1500);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("GX:");
    lcd.print(gx, 1);
    lcd.print(" GY:");
    lcd.print(gy, 1);
    lcd.setCursor(0, 1);
    lcd.print("GZ:");
    lcd.print(gz, 1);
    lcd.print("      ");

    tone(BUZZER, 2000);
    digitalWrite(LED, HIGH);

    delay(1500);

    noTone(BUZZER);
    digitalWrite(LED, LOW);

    rolloverHitCount = 0;
    rollover = false;
    accident = false;
    lcd.clear();
  }

  else if (accident) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ACCIDENT!");
    lcd.setCursor(0, 1);
    lcd.print(level);


    if (level == "SEVERE") {
      tone(BUZZER, 2000);
    } 
    else if (level == "MODERATE") {
      tone(BUZZER, 1200);
    } 
    else {
      tone(BUZZER, 800);
    }

    digitalWrite(LED, HIGH);

    delay(3000);

    noTone(BUZZER);
    digitalWrite(LED, LOW);

    accident = false;
    lcd.clear();
  }

  else {
    if (rolloverHitCount > 0) {
      lcd.setCursor(0, 0);
      lcd.print("ROLL CHECK... ");
      lcd.setCursor(0, 1);
      lcd.print("T");
      lcd.print(tiltDeg, 0);
      lcd.print(" G");
      lcd.print(gyroXY, 1);
      lcd.print("      ");
    } else {
      lcd.setCursor(0, 0);
      lcd.print("No Accident   ");
      lcd.setCursor(0, 1);
      lcd.print("Monitoring... ");
    }
  }

  delay(500);
}