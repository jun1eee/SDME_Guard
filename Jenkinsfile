pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout([
                      $class: 'GitSCM',
                      branches: [[name: env.gitlabSourceBranch ?: 'dev']],
                      userRemoteConfigs: [[
                          url: 'https://lab.ssafy.com/s14-fintech-finance-sub1/S14P21A105.git',
                          credentialsId: 'gitlab-credentials'
                      ]]
                  ])
            }
        }

        stage('Build Backend') {
            when {
                expression {
                    return env.gitlabSourceBranch == 'dev'
                }
            }
            steps {
                dir('be') {
                    sh 'chmod +x ./gradlew'
                    sh './gradlew clean build -x test'
                }
            }
        }

        stage('Build Frontend') {
            when {
                expression {
                    return env.gitlabSourceBranch == 'dev'
                }
            }
            steps {
                dir('fe') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            when {
                expression {
                    return env.gitlabActionType == 'PUSH' && env.gitlabSourceBranch == 'dev'
                }
            }
            steps {
                sh '''
                    cd /var/jenkins_home/workspace/sdmguard
                    docker-compose up -d --build ai backend frontend nginx
                '''
            }
        }

        stage('Health Check') {
            when {
                expression {
                    return env.gitlabActionType == 'PUSH' && env.gitlabSourceBranch == 'dev'
                }
            }
            steps {
                sh '''
                    echo "Waiting for AI server..."
                    for i in 1 2 3 4 5 6; do
                        sleep 15
                        if docker exec ai python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" 2>/dev/null; then
                            echo "AI health check passed (attempt $i)"
                            exit 0
                        fi
                        echo "Attempt $i failed, retrying..."
                    done
                    echo "AI health check failed after 6 attempts (90s timeout)"
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            updateGitlabCommitStatus name: 'build', state: 'success'
        }
        failure {
            updateGitlabCommitStatus name: 'build', state: 'failed'
        }
    }
}
