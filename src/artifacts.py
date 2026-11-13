"""Verified offline builds and atomic file activation; never publishes implicitly."""
from pathlib import Path
import hashlib
import json
import os
import tempfile


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def seal(root, run_id, experiment_id, metadata=None):
    root = Path(root).resolve()
    artifacts = {p.relative_to(root).as_posix(): sha(p) for p in sorted(root.rglob('*'))
                 if p.is_file() and p.suffix in {'.csv','.json','.arff','.txt'} and p.name != 'manifest.json'}
    if not artifacts:
        raise ValueError('No artifacts to verify')
    payload = dict(run_id=run_id, experiment_id=experiment_id, artifacts=artifacts,
                   validation_status='verified_local', metadata=metadata or {})
    (root/'manifest.json').write_text(json.dumps(payload, indent=2, allow_nan=False), encoding='utf-8')
    return payload


def verify(root):
    root = Path(root).resolve()
    manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('validation_status') != 'verified_local' or not manifest.get('artifacts'):
        raise ValueError('Unverified build')
    for name, digest in manifest['artifacts'].items():
        path = (root/name).resolve()
        if not path.is_relative_to(root) or not path.is_file() or sha(path) != digest:
            raise ValueError(f'Artifact mismatch: {name}')
    return manifest


def activate(root, target, fail_before_activate=False):
    """Explicit local file-snapshot pointer. os.replace keeps the prior pointer on failure."""
    root, target = Path(root).resolve(), Path(target).resolve()
    manifest = verify(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(dict(directory=str(root), run_id=manifest['run_id'], manifest_sha256=sha(root/'manifest.json')))
    fd, temporary = tempfile.mkstemp(dir=target.parent, prefix='.activation-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        if fail_before_activate:
            raise RuntimeError('Injected pre-activation failure')
        os.replace(temporary, target)
    finally:
        if Path(temporary).exists(): Path(temporary).unlink()
    return manifest
