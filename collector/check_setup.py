from __future__ import annotations

import shutil
import socket
import subprocess
import sys
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Status:
    name: str
    state: str
    detail: str


def run_command(command: list[str]) -> tuple[int, str]:
    resolved_command = command.copy()
    if resolved_command:
        resolved_command[0] = shutil.which(resolved_command[0]) or resolved_command[0]

    try:
        completed = subprocess.run(
            resolved_command,
            capture_output=True,
            text=True,
            timeout=12,
            check=False,
        )
        output = "\n".join(
            part.strip()
            for part in [completed.stdout, completed.stderr]
            if part and part.strip()
        )
        return completed.returncode, output
    except FileNotFoundError:
        return 127, "Command tidak ditemukan."
    except subprocess.TimeoutExpired:
        return 124, "Command timeout."


def check_python_package() -> Status:
    try:
        import appium  # noqa: F401

        return Status("Python Appium Client", "OK", "Package Python sudah terpasang.")
    except ImportError:
        return Status(
            "Python Appium Client",
            "PERLU DIPASANG",
            "Jalankan: pip install -r requirements.txt",
        )


def check_adb_command() -> Status:
    if not shutil.which("adb"):
        known_adb_paths = [
            Path(r"C:\platform-tools\adb.exe"),
            Path.home() / "AppData" / "Local" / "Android" / "Sdk" / "platform-tools" / "adb.exe",
        ]
        existing_adb_path = next((path for path in known_adb_paths if path.exists()), None)
        if existing_adb_path:
            return Status(
                "ADB / Android Platform Tools",
                "PERLU DITAMBAH KE PATH",
                f"adb.exe ditemukan di {existing_adb_path.parent}, tetapi folder ini belum masuk PATH.",
            )

        return Status(
            "ADB / Android Platform Tools",
            "PERLU DIPASANG",
            "Command adb belum dikenali. Install Android Platform Tools dan tambahkan ke PATH.",
        )

    code, output = run_command(["adb", "version"])
    if code == 0:
        first_line = output.splitlines()[0] if output else "adb tersedia."
        return Status("ADB / Android Platform Tools", "OK", first_line)
    return Status("ADB / Android Platform Tools", "ERROR", output)


def check_adb_devices() -> Status:
    if not shutil.which("adb"):
        return Status("HP Android", "BELUM BISA DICEK", "ADB belum tersedia.")

    code, output = run_command(["adb", "devices"])
    if code != 0:
        return Status("HP Android", "ERROR", output)

    device_lines = [
        line.strip()
        for line in output.splitlines()
        if line.strip() and not line.lower().startswith("list of devices")
    ]

    if not device_lines:
        return Status(
            "HP Android",
            "BELUM TERHUBUNG",
            "Sambungkan HP, aktifkan USB Debugging, lalu pilih Allow saat prompt muncul.",
        )

    unauthorized = [line for line in device_lines if "unauthorized" in line]
    if unauthorized:
        return Status(
            "HP Android",
            "BELUM DIIZINKAN",
            "Prompt USB debugging belum di-Allow di HP. Cabut pasang kabel jika prompt belum muncul.",
        )

    offline = [line for line in device_lines if "offline" in line]
    if offline:
        return Status("HP Android", "OFFLINE", "Cabut pasang kabel USB lalu ulangi adb devices.")

    ready = [line for line in device_lines if "\tdevice" in line or line.endswith(" device")]
    if ready:
        return Status("HP Android", "OK", f"{len(ready)} device terdeteksi dan sudah authorized.")

    return Status("HP Android", "PERLU DICEK", output)


def sdk_root_has_adb(path: Path) -> bool:
    return (path / "platform-tools" / "adb.exe").exists()


def sdk_root_from_adb_path() -> Path | None:
    adb_path = shutil.which("adb")
    if not adb_path:
        return None
    platform_tools_path = Path(adb_path).resolve().parent
    if platform_tools_path.name.lower() != "platform-tools":
        return None
    return platform_tools_path.parent


def check_android_sdk_environment() -> Status:
    env_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if env_root:
        root_path = Path(env_root)
        if sdk_root_has_adb(root_path):
            return Status("Android SDK Environment", "OK", f"ANDROID_HOME/SDK_ROOT mengarah ke {root_path}.")
        return Status(
            "Android SDK Environment",
            "ERROR",
            f"ANDROID_HOME/SDK_ROOT mengarah ke {root_path}, tetapi platform-tools\\adb.exe tidak ditemukan.",
        )

    known_roots = [
        sdk_root_from_adb_path(),
        Path(r"C:\platform-tools").parent if Path(r"C:\platform-tools\adb.exe").exists() else None,
        Path.home() / "AppData" / "Local" / "Android" / "Sdk",
    ]
    existing_root = next((path for path in known_roots if path and sdk_root_has_adb(path)), None)
    if existing_root:
        return Status(
            "Android SDK Environment",
            "PERLU DISET",
            f"Set ANDROID_HOME dan ANDROID_SDK_ROOT ke {existing_root}, lalu restart Appium server.",
        )

    return Status(
        "Android SDK Environment",
        "PERLU DIPASANG",
        "Android SDK root belum ditemukan. Install Android Platform Tools atau set ANDROID_HOME/ANDROID_SDK_ROOT.",
    )


def check_appium_command() -> Status:
    if not shutil.which("appium"):
        return Status(
            "Appium CLI",
            "PERLU DIPASANG",
            "Command appium belum dikenali. Jalankan: npm install -g appium",
        )

    code, output = run_command(["appium", "--version"])
    if code == 0:
        return Status("Appium CLI", "OK", f"Versi {output.splitlines()[0] if output else '-'}")
    return Status("Appium CLI", "ERROR", output)


def check_uiautomator2_driver() -> Status:
    if not shutil.which("appium"):
        return Status("UiAutomator2 Driver", "BELUM BISA DICEK", "Appium CLI belum tersedia.")

    code, output = run_command(["appium", "driver", "list", "--installed"])
    if code != 0:
        return Status("UiAutomator2 Driver", "ERROR", output)

    if "uiautomator2" in output.lower():
        return Status("UiAutomator2 Driver", "OK", "Driver uiautomator2 sudah terpasang.")

    return Status(
        "UiAutomator2 Driver",
        "PERLU DIPASANG",
        "Jalankan: appium driver install uiautomator2",
    )


def check_appium_server() -> Status:
    try:
        with socket.create_connection(("127.0.0.1", 4723), timeout=3):
            return Status("Appium Server", "OK", "Server aktif di http://127.0.0.1:4723")
    except OSError:
        return Status(
            "Appium Server",
            "BELUM AKTIF",
            "Jalankan di terminal terpisah: appium --base-path /",
        )


def print_statuses(statuses: list[Status]) -> int:
    print("")
    print("STATUS UI COLLECTOR")
    print("=" * 60)
    for status in statuses:
        print(f"[{status.state}] {status.name}")
        print(f"  {status.detail}")
        print("")

    blocking_states = {
        "PERLU DIPASANG",
        "PERLU DITAMBAH KE PATH",
        "PERLU DISET",
        "BELUM TERHUBUNG",
        "BELUM DIIZINKAN",
        "OFFLINE",
        "ERROR",
    }
    has_blocker = any(status.state in blocking_states for status in statuses)
    has_server_missing = any(
        status.name == "Appium Server" and status.state == "BELUM AKTIF" for status in statuses
    )

    if has_blocker:
        print("KESIMPULAN: Setup belum siap. Perbaiki status yang belum OK dulu.")
        return 1

    if has_server_missing:
        print("KESIMPULAN: Hampir siap. Jalankan Appium server sebelum menjalankan collector.")
        return 1

    print("KESIMPULAN: Setup siap. Buka Bidding Plus lalu jalankan python appium_collector.py")
    return 0


def main() -> int:
    statuses = [
        check_python_package(),
        check_adb_command(),
        check_adb_devices(),
        check_android_sdk_environment(),
        check_appium_command(),
        check_uiautomator2_driver(),
        check_appium_server(),
    ]
    return print_statuses(statuses)


if __name__ == "__main__":
    sys.exit(main())
