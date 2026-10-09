"""The only access check (D25).

    access.can_read(user, chapter)    -> bool
    access.refusal_for(user, chapter) -> str | None   the same check, with its reason
    access.owns(user, book)           -> bool   the first of can_read's two questions

**No caller queries `Order` or `TemporalGrant` directly.** Cadence landed as
D50, and its unlock check lives *inside this module's one check*. That is the whole promise
of the seam, and it's why nothing else may ask the question.

It returns a plain bool and never raises. A service raising an error whose only
purpose is to become a 403 has put HTTP in the service layer; refusals become
status codes at the API layer.
"""

from ..models import Order, TemporalGrant

# Refusal codes (D38). The API layer maps these to status codes; nothing here
# knows what a 403 is.
NOT_OWNER = "not_owner"
NOT_UNLOCKED = "not_unlocked"


def owns(user, book) -> bool:
    """Does this person, still active, own this book?

    Only the cadence tick asks this on its own: its chapter is locked by
    definition, so `can_read` would refuse the very grant it is unlocking.
    Everyone else asks `can_read`.
    """
    return _owns(user, book.pk)


def can_read(user, chapter) -> bool:
    """Two questions (D25): do they own the book, and has this chapter unlocked?

    Ownership is re-checked on every request, including grant-authenticated
    ones, so a refund or a revoked entitlement takes effect on the *next*
    request rather than when a token expires.

    A chapter stays locked while the reader holds a `scheduled` grant for it.
    It is not "while `unlock_at` is in the future", because the tick is the one
    clock (D39). A chapter the tick has not unlocked yet is still locked, even if
    only for the next fifteen minutes; two clocks would disagree at the edges.
    A reader from before cadence holds no scheduled rows, so this changes
    nothing for them.
    """
    return refusal_for(user, chapter) is None


def refusal_for(user, chapter) -> str | None:
    """Why this reader may not read this chapter, as a refusal code — or None.

    The same two questions as `can_read`, in the same order, in one place; this
    one says *which* of them failed, and `can_read` is now defined in terms of
    it. There is still exactly one implementation of the rule (D25).

    The API layer needs the distinction because the two refusals are different
    screens: "not yours" is a dead end, and "not yet" is a date the reader can
    wait for (#114).
    """
    if not _owns(user, chapter.book_id):
        return NOT_OWNER

    if _is_scheduled(user, chapter):
        return NOT_UNLOCKED

    return None


def _is_scheduled(user, chapter) -> bool:
    return TemporalGrant.objects.filter(
        user=user, chapter=chapter, state=TemporalGrant.SCHEDULED
    ).exists()


def _owns(user, book_id) -> bool:
    if user is None or not user.is_authenticated:
        return False

    # A deactivated or erased reader (D80). Checked here, in the one access
    # question, so every link they already hold stops working on its next
    # request, whether it arrived by session or by grant token. It also stops
    # the tick from sending them the rest of the book.
    if not user.is_active:
        return False

    return Order.objects.filter(user=user, book_id=book_id).exists()
