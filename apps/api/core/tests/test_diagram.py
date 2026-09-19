"""The diagram renders from the table, so it cannot drift from the code."""

from django.test import TestCase

from core.machines.diagram import to_mermaid
from core.machines.reading import reading_machine
from core.machines.registry import MACHINES


class DiagramTests(TestCase):
    def test_every_machine_renders(self):
        for spec in MACHINES:
            self.assertIn("stateDiagram-v2", to_mermaid(spec))

    def test_the_initial_state_is_marked(self):
        self.assertIn("[*] --> live", to_mermaid(reading_machine))

    def test_guards_appear_on_the_edge_they_belong_to(self):
        self.assertIn("OPEN [is_live, owns_book]", to_mermaid(reading_machine))

    def test_an_internal_transition_loops_back_to_its_own_state(self):
        """A refusal stays put, so it must read as a self-edge."""
        self.assertIn("live --> live:", to_mermaid(reading_machine))

    def test_a_row_with_several_sources_renders_one_edge_each(self):
        diagram = to_mermaid(reading_machine)

        self.assertIn("live --> live: REISSUE", diagram)
        self.assertIn("opened --> opened: REISSUE", diagram)
