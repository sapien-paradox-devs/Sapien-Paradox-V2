"""Effects. All business I/O lives here (D36).

Machines decide *when* these are called; nothing bypasses them. The three seams
are `access.can_read`, `onboarding.create_reader` and `whatsapp.send_chapter`.
"""
