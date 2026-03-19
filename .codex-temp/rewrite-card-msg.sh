#!/bin/sh

if [ "$GIT_COMMIT" = "456edc8e520cb7cd3ca150e940d7b98a300c3c1b" ]; then
  printf '%s\n' 'feat: 카드 DB 및 테스트 코드'
else
  cat
fi
