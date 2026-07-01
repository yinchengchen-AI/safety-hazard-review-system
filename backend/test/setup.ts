// E2E setup: a single test schema is dropped/recreated per session,
// mirroring the conftest.py pattern from the Python backend. Each
// test gets a fresh ``TestingModule`` so per-test seeding can run
// without bleeding across tests.
import 'reflect-metadata';
