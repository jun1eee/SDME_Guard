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
                     docker compose up -d --build ai backend frontend nginx
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
                     sleep 15
                     curl -f http://localhost:8000/healthz || exit 1
                     echo "AI health check passed"
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