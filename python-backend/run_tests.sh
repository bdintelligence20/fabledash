#!/bin/bash

# Run pytest with coverage
python -m pytest -v --cov=app --cov-report=term --cov-report=html

# Exit with the pytest exit code
exit $?
