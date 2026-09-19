"""The only access check (D25).

    access.can_read(user, chapter) -> bool

**No caller queries `Order` or `TemporalGrant` directly.** When cadence lands,
the unlock check is added *inside this function* — that is the whole promise of
the seam, and why nothing else is allowed to ask the question.

It returns a plain bool and never raises. A service raising an error whose only
purpose is to become a 403 has put HTTP in the service layer; refusals become
status codes at the API layer.
"""

from ..models import Order


def can_read(user, chapter) -> bool:
    """Does this person own the book this chapter belongs to?

    Today that is the whole question. Ownership is re-checked on every request,
    including grant-authenticated ones, so a refund or a revoked entitlement
    takes effect on the *next* request rather than when a token expires.
    """
    if user is None or not user.is_authenticated:
        return False

    return Order.objects.filter(user=user, book_id=chapter.book_id).exists()
