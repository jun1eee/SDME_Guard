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
            steps {
                dir('be') {
                    sh 'chmod +x ./gradlew'
                    sh './gradlew clean build -x test'
                }
            }
        }

        stage('Build Frontend') {
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
                 docker rm -f frontend backend nginx 2>/dev/null || true
                 docker-compose -f /var/jenkins_home/workspace/sdmguard/docker-compose.yml down --remove-orphans
                 docker-compose -f /var/jenkins_home/workspace/sdmguard/docker-compose.yml up -d --build
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