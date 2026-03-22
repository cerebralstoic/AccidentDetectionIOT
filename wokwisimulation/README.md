# IoT-Based Accident and Rollover Detection System

## Project Overview

This project implements an accident and rollover detection system using ESP32 and MPU6050.

It detects:
- Sudden impact events using accelerometer data
- Rollover events using tilt angle and gyroscope thresholds

It provides:
- Audio alert through buzzer
- Visual alert through LED
- Live status on 16x2 I2C LCD

## Circuit Diagram

View the full circuit here:

[https://wokwi.com/projects/459176751253382145](https://wokwi.com/projects/459176751253382145)

## Components Used

- ESP32 DevKit V1
- MPU6050 (accelerometer + gyroscope)
- 16x2 I2C LCD
- Buzzer
- LED
- 220 ohm resistor
- Jumper wires

## Pin Connections

### MPU6050 to ESP32

| MPU6050 Pin | ESP32 Pin |
| --- | --- |
| VCC | 3.3V |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |

### I2C LCD to ESP32

| LCD Pin | ESP32 Pin |
| --- | --- |
| VCC | 5V |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |

Note: MPU6050 and LCD share the same I2C bus (GPIO 21/22) with different I2C addresses.

### Buzzer to ESP32

| Buzzer Pin | ESP32 Pin |
| --- | --- |
| Signal | GPIO 25 |
| GND | GND |

### LED to ESP32

| LED Pin | ESP32 Pin |
| --- | --- |
| Anode | GPIO 26 (through 220 ohm resistor) |
| Cathode | GND |

## Detection Logic

### Accident Levels (Accelerometer)

- Minor: |AX| > 10 or |AY| > 10
- Moderate: |AX| > 15 or |AY| > 15
- Severe: |AX| > 20 or |AY| > 20 or |AZ| > 25

### Rollover Detection (Tilt + Gyro)

The code computes:
- `tiltDeg = atan2(sqrt(ax^2 + ay^2), az) * 57.2958`
- `gyroXY = max(|gx|, |gy|)`

Rollover candidate condition:
- `(tiltDeg > 75 and gyroXY > 1.2)` OR `(gyroXY > 3.5 and tiltDeg > 45)`

Rollover is confirmed only after 3 consecutive candidate detections.

## Output Behavior

- Normal: `No Accident` / `Monitoring...`
- Rollover check in progress: `ROLL CHECK...`
- Accident (impact): `ACCIDENT!` + severity level
- Accident (rollover): `ACCIDENT!` / `ROLL OVER`

During rollover alert, LCD also displays:
- Tilt and gyro summary
- AX, AY values
- GX, GY, GZ values

## Source File

Main sketch:
- `wokwisimulation/accidentdetectorsim.ino`
