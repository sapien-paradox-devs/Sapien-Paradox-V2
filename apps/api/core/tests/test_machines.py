"""The machine framework, driven by a toy machine.

The real machines have their own tests. This file only covers `dispatch` and
the binding, so it defines the smallest machine that exercises them: a door
that opens when it is unlocked and refuses when it is not.
"""

from types import SimpleNamespace

from django.test import TestCase

from core.machines import Spec, dispatch


# ── the toy machine ───────────────────────────────────────────────────────────


def is_unlocked(door, ctx):
    return not door.locked


def refuse_locked(door, ctx):
    ctx.refuse("door_locked")


def record_opener(door, ctx):
    ctx.produce(ctx.payload.who)


door_machine = Spec(
    name="door",
    initial="shut",
    states=["shut", "open"],
    transitions=[
        {
            "trigger": "OPEN",
            "source": "shut",
            "dest": "open",
            "conditions": [is_unlocked],
            "after": [record_opener],
        },
        # A refusal row fires and stays put, so the result can say *why*.
        {"trigger": "OPEN", "source": "shut", "dest": "shut", "after": [refuse_locked]},
    ],
)


class Door:
    """A plain object — no Django, which is the point of D37."""

    def __init__(self, locked=False, state="shut"):
        self.locked = locked
        self.state = state


class DispatchTests(TestCase):
    def test_matching_transition_moves_state_and_reports_ok(self):
        result = dispatch(door_machine, Door(), "OPEN", who="ada")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, "open")
        self.assertIsNone(result.refusal)

    def test_action_output_comes_back_as_data(self):
        result = dispatch(door_machine, Door(), "OPEN", who="ada")

        self.assertEqual(result.data, "ada")

    def test_refusal_row_reports_its_code_and_does_not_move(self):
        result = dispatch(door_machine, Door(locked=True), "OPEN", who="ada")

        self.assertFalse(result.ok)
        self.assertEqual(result.state, "shut")
        self.assertEqual(result.refusal, "door_locked")

    def test_event_with_no_transition_from_this_state_is_inert(self):
        door = Door(state="open")

        result = dispatch(door_machine, door, "OPEN", who="ada")

        self.assertFalse(result.ok)
        self.assertEqual(result.state, "open")
        self.assertEqual(result.refusal, "no_transition")

    def test_unknown_event_is_inert_rather_than_raising(self):
        result = dispatch(door_machine, Door(), "DEMOLISH")

        self.assertFalse(result.ok)
        self.assertEqual(result.state, "shut")

    def test_guards_and_actions_read_injected_dependencies(self):
        seen = []

        def announce(door, ctx):
            ctx.deps.log("opened")

        spec = Spec(
            name="announcing-door",
            initial="shut",
            states=["shut", "open"],
            transitions=[
                {"trigger": "OPEN", "source": "shut", "dest": "open", "after": [announce]}
            ],
        )

        dispatch(spec, Door(), "OPEN", deps=SimpleNamespace(log=seen.append))

        self.assertEqual(seen, ["opened"])

    def test_starts_from_the_subject_current_state_not_the_spec_initial(self):
        result = dispatch(door_machine, Door(state="open"), "OPEN")

        self.assertEqual(result.state, "open")

    def test_dispatching_twice_on_one_subject_does_not_reattach(self):
        door = Door(locked=True)

        first = dispatch(door_machine, door, "OPEN", who="ada")
        door.locked = False
        second = dispatch(door_machine, door, "OPEN", who="ada")

        self.assertFalse(first.ok)
        self.assertTrue(second.ok)
        self.assertEqual(second.state, "open")


class PersistenceTests(TestCase):
    def test_subject_is_persisted_when_the_transition_succeeds(self):
        saved = []

        dispatch(door_machine, Door(), "OPEN", persist=saved.append, who="ada")

        self.assertEqual(len(saved), 1)

    def test_subject_is_not_persisted_when_the_transition_refuses(self):
        saved = []

        dispatch(door_machine, Door(locked=True), "OPEN", persist=saved.append, who="ada")

        self.assertEqual(saved, [])
