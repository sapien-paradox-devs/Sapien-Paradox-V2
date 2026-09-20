"""Bring existing phone numbers to one spelling.

`User.phone` is unique and nothing normalised it, so rows may hold whatever a
form submitted. Until they agree, `reset_request` cannot find a reader who types
their own number differently, and `_resolve_identity` reads two spellings as two
people.

Collisions are left alone rather than merged: two rows normalising to one value
means two accounts for one human, and picking a survivor is a judgement about
someone's purchases that a migration must not make silently. They are reported
instead.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    from core.services.phone import normalize

    User = apps.get_model("core", "User")

    seen = {}
    for user in User.objects.all().order_by("pk"):
        target = normalize(user.phone)
        if not target or target == user.phone:
            seen.setdefault(target, user.pk)
            continue

        clash = (
            seen.get(target)
            or User.objects.filter(phone=target).exclude(pk=user.pk).values_list("pk", flat=True).first()
        )
        if clash:
            print(
                f"  ! user {user.pk} ({user.phone!r}) normalises onto user {clash} "
                f"({target!r}) — left unchanged, resolve by hand"
            )
            continue

        User.objects.filter(pk=user.pk).update(phone=target)
        seen[target] = user.pk


def backwards(apps, schema_editor):
    """Irreversible in substance — the original spellings are not recorded."""


class Migration(migrations.Migration):
    dependencies = [("core", "0004_order_payment_reference")]

    operations = [migrations.RunPython(forwards, backwards)]
