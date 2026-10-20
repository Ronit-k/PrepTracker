"""Exercise subject loading with out-of-order responses, without a real browser."""
from pathlib import Path
import shutil
import subprocess

import pytest


def test_slow_subject_response_cannot_replace_current_tab():
    if not shutil.which('node'):
        pytest.skip('Node is required for the subject-loading regression test')
    source = Path('static/js/app.js').read_text()
    loader = source[source.index('async function loadSubject('):
                    source.index('function populateTopicList(')]
    script = r"""
const assert = require('node:assert/strict');
let subjectLoadVersion = 0, currentSubject = 'dsa', currentPage = 'subject';
let subjectQuestions = [], subjectTopics = [];
let rendered = null, populated = null;
const subjectTitle = {}, addButton = {}, attrs = {};
const treeContainer = {setAttribute(k, v) {attrs[k] = v;}};
const $ = () => addButton;
const subjectConfig = subject => ({label: subject.toUpperCase()});
const pending = [];
const api = () => new Promise((resolve, reject) => pending.push({resolve, reject}));
const renderTree = () => {rendered = [...subjectQuestions];};
const populateTopicList = topics => {populated = topics;};
const showToast = () => {throw new Error('Stale failure must not show a toast');};
""" + loader + r"""
(async () => {
  const first = loadSubject('dsa');
  currentSubject = 'sql';
  const second = loadSubject('sql');
  pending[2].resolve([{id:'sql', title:'SQL question'}]);
  pending[3].resolve(['Joins']);
  await second;
  pending[0].resolve([{id:'dsa', title:'DSA question'}]);
  pending[1].resolve(['Arrays']);
  await first;
  assert.equal(subjectTitle.textContent, 'SQL');
  assert.deepEqual(rendered, [{id:'sql', title:'SQL question'}]);
  assert.deepEqual(populated, ['Joins']);
  assert.equal(addButton.disabled, false);

  // A stale failure must not replace a successful later visit to the same tab.
  currentSubject = 'dsa';
  const oldVisit = loadSubject('dsa');
  currentSubject = 'sql';
  const sqlVisit = loadSubject('sql');
  currentSubject = 'dsa';
  const newVisit = loadSubject('dsa');
  pending[8].resolve([{id:'fresh-dsa'}]);
  pending[9].resolve(['Trees']);
  await newVisit;
  pending[4].reject(new Error('Old request failed'));
  pending[5].resolve([]);
  pending[6].resolve([{id:'old-sql'}]);
  pending[7].resolve(['Joins']);
  await Promise.all([oldVisit, sqlVisit]);
  assert.deepEqual(rendered, [{id:'fresh-dsa'}]);
  assert.deepEqual(populated, ['Trees']);
  assert.equal(attrs['aria-busy'], 'false');
})().catch(error => {console.error(error);process.exitCode=1;});
"""
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
