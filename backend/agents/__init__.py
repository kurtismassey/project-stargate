"""AI assistance for the platform.

Both agents fail closed. Without GOOGLE_API_KEY the monitor stays silent
and the analyst endpoint returns unavailable, and the session loop runs
unaffected.
"""

from .analyst.tool import run_analyst
from .monitor.tool import run_monitor

__all__ = ["run_analyst", "run_monitor"]
