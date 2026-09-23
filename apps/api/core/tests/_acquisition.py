"""Buy a book the way the webhook does — through the acquisition machine.

Identity resolution lives in the machine (D59), so a test about *which reader a
purchase resolves to* has to go through it. Tests about what `create_reader`
still guarantees — atomicity, delivery, the reset token — call the seam directly
and pass the reader in.

Deliberately reuses `checkout._deps`, so these tests exercise the same wiring the
endpoint does rather than a parallel set of fakes.
"""

from core.api.checkout import _deps
from core.machines import dispatch
from core.machines.acquisition import PurchaseAttempt, acquisition_machine


def purchase(book, email="ada@example.com", phone="+919876543210",
             full_name="Ada", pace="medium", payment_reference=""):
    """Dispatch PAID. Returns a TransitionResult: `.ok`, `.refusal`, `.data`."""
    attempt = PurchaseAttempt(
        full_name=full_name,
        email=email,
        phone=phone,
        book_slug=book.slug,
        pace=pace,
        payment_reference=payment_reference,
    )
    return dispatch(acquisition_machine, attempt, "PAID", deps=_deps())
