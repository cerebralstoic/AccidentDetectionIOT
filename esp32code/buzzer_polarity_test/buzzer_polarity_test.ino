// Test 2: Buzzer wired with VCC FLOATING (disconnected).
// Only I/O -> GPIO 27 and GND -> ESP32 GND.
// Tells us if GPIO 27 alone can both power AND control the buzzer.

#define BUZZER 27

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  Serial.println("Buzzer test starting. VCC should be DISCONNECTED.");
  Serial.println("Only I/O pin -> GPIO 27 and GND -> GND.");
  delay(2000);
}

void loop() {
  Serial.println("=== GPIO HIGH (3.3V) for 3 seconds ===");
  digitalWrite(BUZZER, HIGH);
  delay(3000);

  Serial.println("=== GPIO LOW (0V) for 3 seconds ===");
  digitalWrite(BUZZER, LOW);
  delay(3000);
}
