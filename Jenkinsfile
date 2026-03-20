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

        // MR일 때는 여기서 끝 (CI만)
        stage('Deploy') {
            when {
                branch 'dev'  // dev 브랜치에 실제 merge됐을 때만 배포
            }
            steps {
                sh 'docker-compose -f /var/jenkins_home/workspace/sdmguard/docker-compose.yml down --remove-orphans'
                sh 'docker-compose -f /var/jenkins_home/workspace/sdmguard/docker-compose.yml up -d --build'
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